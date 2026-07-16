"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { getPrimarySiteWithSettings } from "@/db/site";
import { AppError, ForbiddenError } from "@/lib/errors";
import { requirePermission } from "@/modules/authorization/permissions";
import {
  emailVerificationSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
  setupSchema
} from "@/modules/auth/schemas";
import { login, registerUser } from "@/modules/auth/service";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  verifyEmailToken
} from "@/modules/auth/recovery";
import {
  clearSessionCookies,
  getCurrentSession,
  invalidateCurrentSession,
  invalidateUserSessions,
  setSessionCookies
} from "@/modules/auth/session";
import { deleteMedia, uploadMedia } from "@/modules/media/service";
import {
  createPage,
  publishPage,
  renamePage,
  restorePage,
  rollbackPage,
  saveDraft,
  softDeletePage
} from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { updateSiteSettings } from "@/modules/settings/service";
import {
  assignRoleToGroup,
  assignUserToGroup,
  createGroup,
  createRole,
  permissionKeys
} from "@/modules/authorization/permissions";
import { createUser, setUserStatus } from "@/modules/users/service";

export async function setupAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = setupSchema.parse(Object.fromEntries(formData.entries()));
    const { owner } = await completeSetup(parsed);
    const session = await login({ identifier: owner.username, password: parsed.ownerPassword });
    await setSessionCookies(session.token, session.csrfToken);
  } catch (error) {
    return actionError(error);
  }
  redirect("/");
}

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = loginSchema.parse(Object.fromEntries(formData.entries()));
    const session = await login(parsed);
    await setSessionCookies(session.token, session.csrfToken);
  } catch (error) {
    return actionError(error);
  }
  redirect("/");
}

export async function registerAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const parsed = registerSchema.parse(Object.fromEntries(formData.entries()));
    await registerUser(parsed);
  } catch (error) {
    return actionError(error);
  }
  redirect("/login?registered=1");
}

export async function logoutAction() {
  await invalidateCurrentSession();
  await clearSessionCookies();
  redirect("/");
}

export async function requestPasswordResetAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const parsed = passwordResetRequestSchema.parse(Object.fromEntries(formData.entries()));
    await requestPasswordReset(parsed.identifier);
    return {
      ok: true,
      message:
        "If an account matches that identifier and email is configured, a reset link has been sent."
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function resetPasswordAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const parsed = passwordResetSchema.parse(Object.fromEntries(formData.entries()));
    await resetPasswordWithToken(parsed);
  } catch (error) {
    return actionError(error);
  }
  redirect("/login?reset=1");
}

export async function verifyEmailAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const parsed = emailVerificationSchema.parse(Object.fromEntries(formData.entries()));
    await verifyEmailToken(parsed.token);
  } catch (error) {
    return actionError(error);
  }
  redirect("/login?verified=1");
}

export async function createPageAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  let target: string | undefined;
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "page.create");
    const publish = formData.get("intent") === "publish";
    if (publish) {
      await requirePermission(session.user.id, site.site.id, "page.publish");
    }
    const result = await createPage({
      siteId: site.site.id,
      title: stringValue(formData, "title"),
      slug: optionalString(formData, "slug"),
      markdown: stringValue(formData, "markdown"),
      editSummary: optionalString(formData, "editSummary"),
      publish,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/");
    target = `/page/${result.page.slug}`;
  } catch (error) {
    return actionError(error);
  }
  if (!target) {
    return { ok: false, message: "Page was not created." };
  }
  redirect(target);
}

export async function saveDraftAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "page.edit");
    await saveDraft({
      pageId: stringValue(formData, "pageId"),
      baseRevisionId: optionalString(formData, "baseRevisionId"),
      markdown: stringValue(formData, "markdown"),
      editSummary: optionalString(formData, "editSummary"),
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath(`/edit/${stringValue(formData, "slug")}`);
    return { ok: true, message: "Draft saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function publishPageAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "page.publish");
    const revision = await publishPage({
      pageId: stringValue(formData, "pageId"),
      baseRevisionId: optionalString(formData, "baseRevisionId"),
      markdown: stringValue(formData, "markdown"),
      editSummary: optionalString(formData, "editSummary"),
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/");
    revalidatePath(`/page/${stringValue(formData, "slug")}`);
    return { ok: true, message: `Published revision ${revision.revisionNumber}.` };
  } catch (error) {
    return actionError(error);
  }
}

export async function editPageAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const intent = formData.get("intent");
  return intent === "save-draft"
    ? saveDraftAction(_state, formData)
    : publishPageAction(_state, formData);
}

export async function rollbackAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  let target: string | undefined;
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "page.rollback");
    const revision = await rollbackPage({
      pageId: stringValue(formData, "pageId"),
      targetRevisionId: stringValue(formData, "targetRevisionId"),
      reason: optionalString(formData, "reason") ?? "Rollback",
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath(`/history/${stringValue(formData, "slug")}`);
    target = `/page/${stringValue(formData, "slug")}?revision=${revision.revisionNumber}`;
  } catch (error) {
    return actionError(error);
  }
  if (!target) {
    return { ok: false, message: "Rollback was not completed." };
  }
  redirect(target);
}

export async function deletePageAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "page.delete");
    await softDeletePage({
      pageId: stringValue(formData, "pageId"),
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/pages");
    return { ok: true, message: "Page deleted." };
  } catch (error) {
    return actionError(error);
  }
}

export async function restorePageAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "page.restore");
    await restorePage({
      pageId: stringValue(formData, "pageId"),
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/pages");
    return { ok: true, message: "Page restored." };
  } catch (error) {
    return actionError(error);
  }
}

export async function renamePageAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "page.rename");
    await renamePage({
      pageId: stringValue(formData, "pageId"),
      newTitle: stringValue(formData, "newTitle"),
      newSlug: optionalString(formData, "newSlug"),
      createAlias: formData.get("createAlias") === "on",
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/pages");
    return { ok: true, message: "Page renamed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateSettingsAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "site.configure");
    await updateSiteSettings({
      siteId: site.site.id,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName,
      values: {
        tagline: stringValue(formData, "tagline"),
        baseUrl: stringValue(formData, "baseUrl"),
        registrationMode: formData.get("registrationMode") as
          "open" | "email_verification" | "invite" | "closed",
        publicMode: formData.get("publicMode") === "on",
        homepageTitle: stringValue(formData, "homepageTitle"),
        homepageIntro: stringValue(formData, "homepageIntro"),
        footerContent: optionalString(formData, "footerContent") ?? "",
        uploadMaxBytes: Number(formData.get("uploadMaxBytes") ?? 5242880)
      }
    });
    revalidatePath("/");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadMediaAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "media.upload");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("Select a file to upload.", "missing_file", 422);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadMedia({
      siteId: site.site.id,
      uploaderId: session.user.id,
      uploaderDisplayName: session.user.displayName,
      filename: file.name,
      declaredType: file.type,
      bytes,
      altText: optionalString(formData, "altText")
    });
    revalidatePath("/media");
    revalidatePath("/admin/media");
    return { ok: true, message: "Media uploaded." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteMediaAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "media.delete");
    await deleteMedia({
      assetId: stringValue(formData, "assetId"),
      actorId: session.user.id,
      actorDisplayName: session.user.displayName,
      force: formData.get("force") === "on"
    });
    revalidatePath("/media");
    revalidatePath("/admin/media");
    revalidatePath("/admin");
    revalidatePath("/recent");
    return { ok: true, message: "Media deleted." };
  } catch (error) {
    return actionError(error);
  }
}

export async function createUserAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "user.manage");
    const user = await createUser({
      username: stringValue(formData, "username"),
      email: stringValue(formData, "email"),
      displayName: optionalString(formData, "displayName"),
      password: stringValue(formData, "password"),
      status: "active"
    });
    const groupId = optionalString(formData, "groupId");
    if (groupId) {
      await assignUserToGroup(user.id, groupId);
    }
    revalidatePath("/admin/users");
    return { ok: true, message: "User created." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateUserStatusAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "user.manage");
    await setUserStatus({
      siteId: site.site.id,
      userId: stringValue(formData, "userId"),
      status: stringValue(formData, "status") as "active" | "suspended" | "pending"
    });
    revalidatePath("/admin/users");
    return { ok: true, message: "User status updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function resetUserSessionsAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "user.manage");
    await invalidateUserSessions(stringValue(formData, "userId"));
    revalidatePath("/admin/users");
    return { ok: true, message: "Sessions reset." };
  } catch (error) {
    return actionError(error);
  }
}

export async function createGroupAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "group.manage");
    const group = await createGroup({
      siteId: site.site.id,
      name: stringValue(formData, "name"),
      description: optionalString(formData, "description")
    });
    const roleId = optionalString(formData, "roleId");
    if (roleId) {
      await assignRoleToGroup(group.id, roleId);
    }
    revalidatePath("/admin/groups");
    return { ok: true, message: "Group created." };
  } catch (error) {
    return actionError(error);
  }
}

export async function createRoleAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "role.manage");
    const selected = formData
      .getAll("permission")
      .filter((value): value is string => typeof value === "string")
      .filter((value): value is (typeof permissionKeys)[number] =>
        permissionKeys.includes(value as (typeof permissionKeys)[number])
      );
    await createRole({
      siteId: site.site.id,
      name: stringValue(formData, "name"),
      description: optionalString(formData, "description"),
      permissionKeys: selected
    });
    revalidatePath("/admin/roles");
    return { ok: true, message: "Role created." };
  } catch (error) {
    return actionError(error);
  }
}

export type ActionState = {
  ok: boolean;
  message?: string;
};

async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    throw new ForbiddenError("Log in to continue.");
  }
  return session;
}

async function requireSite() {
  const site = await getPrimarySiteWithSettings(db);
  if (!site) {
    throw new AppError("Setup is required.", "setup_required", 503);
  }
  return site;
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    throw new AppError(`Missing field: ${key}`, "validation_error", 422);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  return value;
}

function actionError(error: unknown): ActionState {
  if (error instanceof AppError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: "An unexpected error occurred." };
}
