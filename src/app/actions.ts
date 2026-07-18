"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ZodError } from "zod";
import { db } from "@/db/client";
import { getPrimarySiteWithSettings } from "@/db/site";
import { localizeErrorMessage } from "@/i18n/errors";
import { getRequestI18n } from "@/i18n/server";
import { AppError, ForbiddenError } from "@/lib/errors";
import {
  emailVerificationRequestSchema,
  emailVerificationSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
  setupSchema
} from "@/modules/auth/schemas";
import { login, registerUser } from "@/modules/auth/service";
import {
  requestEmailVerification,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyEmailToken
} from "@/modules/auth/recovery";
import {
  clearSessionCookies,
  createSession,
  getCurrentSession,
  getRequestMetadata,
  invalidateCurrentSession,
  setSessionCookies
} from "@/modules/auth/session";
import { deleteMedia, uploadMedia } from "@/modules/media/service";
import {
  archivePage,
  createPage,
  getPageById,
  publishPage,
  renamePage,
  restorePage,
  rollbackPage,
  saveDraft,
  setPageProtection,
  softDeletePage
} from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { settingsFormSchema } from "@/modules/settings/schemas";
import { updateSiteSettings } from "@/modules/settings/service";
import { unwatchPage, watchPage } from "@/modules/watchlist/service";
import {
  createGroupWithRoles,
  createRole,
  permissionKeys,
  requirePagePublishPermissions,
  requirePermission,
  updateGroup,
  updateRole,
  updateUserGroups
} from "@/modules/authorization/permissions";
import {
  createManagedUser,
  resetManagedUserSessions,
  setUserStatus
} from "@/modules/users/service";
import { managedUserSchema } from "@/modules/users/schemas";

export async function setupAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = setupSchema.parse(Object.fromEntries(formData.entries()));
    const { owner } = await completeSetup(parsed);
    const session = await createSession({ userId: owner.id });
    await setSessionCookies(session.token, session.csrfToken);
  } catch (error) {
    return actionError(error);
  }
  redirect("/");
}

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = loginSchema.parse(Object.fromEntries(formData.entries()));
    const metadata = await getRequestMetadata();
    const session = await login({ ...parsed, clientKey: metadata.ipHash ?? undefined });
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
    const metadata = await getRequestMetadata();
    await registerUser({ ...parsed, clientKey: metadata.ipHash ?? undefined });
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
    const metadata = await getRequestMetadata();
    const resetRequest = {
      identifier: parsed.identifier,
      clientKey: metadata.ipHash ?? undefined
    };
    after(async () => {
      await requestPasswordReset(resetRequest).catch(() => undefined);
    });
    const messages = await getActionMessages();
    return {
      ok: true,
      message: messages.passwordResetSentGeneric
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function requestEmailVerificationAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const parsed = emailVerificationRequestSchema.parse(Object.fromEntries(formData.entries()));
    const metadata = await getRequestMetadata();
    const verificationRequest = {
      identifier: parsed.identifier,
      clientKey: metadata.ipHash ?? undefined
    };
    after(async () => {
      await requestEmailVerification(verificationRequest).catch(() => undefined);
    });
    const messages = await getActionMessages();
    return {
      ok: true,
      message: messages.emailVerificationSentGeneric
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
    target = publish ? `/page/${result.page.slug}` : `/edit/${result.page.slug}`;
  } catch (error) {
    return actionError(error);
  }
  if (!target) {
    const messages = await getActionMessages();
    return { ok: false, message: messages.pageNotCreated };
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
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.draftSaved };
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
    await requirePagePublishPermissions(session.user.id, site.site.id);
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
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return {
      ok: true,
      message: `${messages.publishedRevisionPrefix} ${revision.revisionNumber}.`
    };
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
      reason: optionalString(formData, "reason") ?? "",
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath(`/history/${stringValue(formData, "slug")}`);
    target = `/page/${stringValue(formData, "slug")}?revision=${revision.revisionNumber}`;
  } catch (error) {
    return actionError(error);
  }
  if (!target) {
    const messages = await getActionMessages();
    return { ok: false, message: messages.rollbackNotCompleted };
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
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.pageDeleted };
  } catch (error) {
    return actionError(error);
  }
}

export async function archivePageAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "page.delete");
    const page = await archivePage({
      pageId: stringValue(formData, "pageId"),
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/pages");
    revalidatePath(`/page/${page.slug}`);
    revalidatePath(`/history/${page.slug}`);
    revalidatePath("/search");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.pageArchived };
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
    const slug = optionalString(formData, "slug");
    if (slug) {
      revalidatePath(`/page/${slug}`);
      revalidatePath(`/history/${slug}`);
    }
    revalidatePath("/search");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.pageRestored };
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
    await requirePermission(session.user.id, site.site.id, "page.edit");
    await requirePermission(session.user.id, site.site.id, "page.rename");
    const oldSlug = optionalString(formData, "oldSlug");
    const renamedPage = await renamePage({
      pageId: stringValue(formData, "pageId"),
      newTitle: stringValue(formData, "newTitle"),
      newSlug: optionalString(formData, "newSlug"),
      createAlias: formData.get("createAlias") === "on",
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/pages");
    revalidatePath(`/page/${renamedPage.slug}`);
    revalidatePath(`/edit/${renamedPage.slug}`);
    revalidatePath(`/history/${renamedPage.slug}`);
    if (oldSlug) {
      revalidatePath(`/page/${oldSlug}`);
      revalidatePath(`/edit/${oldSlug}`);
      revalidatePath(`/history/${oldSlug}`);
    }
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.pageRenamed };
  } catch (error) {
    return actionError(error);
  }
}

export async function setPageProtectionAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "page.protect");
    const protectionLevel = pageProtectionLevelValue(formData, "protectionLevel");
    const page = await setPageProtection({
      pageId: stringValue(formData, "pageId"),
      protectionLevel,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/pages");
    revalidatePath(`/page/${page.slug}`);
    revalidatePath(`/edit/${page.slug}`);
    revalidatePath(`/history/${page.slug}`);
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.pageProtectionUpdated };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleWatchPageAction(formData: FormData) {
  const session = await requireSession();
  const site = await requireSite();
  await requirePermission(session.user.id, site.site.id, "page.read");
  const pageId = stringValue(formData, "pageId");
  const pageSlug = stringValue(formData, "slug");
  const intent = stringValue(formData, "intent");
  const input = {
    siteId: site.site.id,
    userId: session.user.id,
    pageId
  };
  const page = await getPageById(pageId);
  if (page.siteId !== site.site.id) {
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    throw new AppError(messages.pageNotFound, "page_not_found", 404);
  }
  if (intent === "watch") {
    await watchPage(input);
  } else if (intent === "unwatch") {
    await unwatchPage(input);
  } else {
    throw new AppError("The request is invalid.", "validation_error", 422);
  }
  revalidatePath(`/page/${pageSlug}`);
  revalidatePath("/watchlist");
  const returnTo = safeReturnPath(optionalString(formData, "returnTo")) ?? `/page/${pageSlug}`;
  redirect(returnTo);
}

export async function updateSettingsAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "site.configure");
    const values = settingsFormSchema.parse(Object.fromEntries(formData.entries()));
    await updateSiteSettings({
      siteId: site.site.id,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName,
      values
    });
    revalidatePath("/");
    revalidatePath("/admin/settings");
    const { messages } = await getRequestI18n(values.defaultLocale);
    return { ok: true, message: messages.settingsUpdated };
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
      const { messages } = await getRequestI18n(site.settings?.defaultLocale);
      throw new AppError(messages.selectFileToUpload, "missing_file", 422);
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
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.mediaUploaded };
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
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.mediaDeleted };
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
    const input = managedUserSchema.parse({
      username: stringValue(formData, "username"),
      email: stringValue(formData, "email"),
      displayName: optionalString(formData, "displayName"),
      password: stringValue(formData, "password"),
      locale: site.settings?.defaultLocale ?? "en",
      groupId: optionalString(formData, "groupId")
    });
    await createManagedUser({
      siteId: site.site.id,
      ...input,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/users");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.userCreated };
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
    const status = stringValue(formData, "status");
    if (status !== "active" && status !== "suspended") {
      throw new AppError("Invalid user status.", "validation_error", 422);
    }
    await setUserStatus({
      siteId: site.site.id,
      userId: stringValue(formData, "userId"),
      status,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/users");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.userStatusUpdated };
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
    await resetManagedUserSessions({
      siteId: site.site.id,
      userId: stringValue(formData, "userId"),
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/users");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.sessionsResetMessage };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateUserGroupsAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "user.manage");
    const groupIds = formData
      .getAll("groupId")
      .filter((value): value is string => typeof value === "string" && value.trim() !== "");
    await updateUserGroups({
      siteId: site.site.id,
      userId: stringValue(formData, "userId"),
      groupIds,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/users");
    revalidatePath("/admin/groups");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.userGroupsUpdated };
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
    const roleId = optionalString(formData, "roleId");
    await createGroupWithRoles({
      siteId: site.site.id,
      name: stringValue(formData, "name"),
      description: optionalString(formData, "description"),
      roleIds: roleId ? [roleId] : [],
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/groups");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.groupCreated };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateGroupAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "group.manage");
    const roleIds = formData
      .getAll("roleId")
      .filter((value): value is string => typeof value === "string" && value.trim() !== "");
    await updateGroup({
      siteId: site.site.id,
      groupId: stringValue(formData, "groupId"),
      name: stringValue(formData, "name"),
      description: optionalString(formData, "description"),
      roleIds,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/groups");
    revalidatePath("/admin/roles");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.groupUpdated };
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
    const selected = permissionListValue(formData);
    await createRole({
      siteId: site.site.id,
      name: stringValue(formData, "name"),
      description: optionalString(formData, "description"),
      permissionKeys: selected,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/roles");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.roleCreated };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRoleAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSession();
    const site = await requireSite();
    await requirePermission(session.user.id, site.site.id, "role.manage");
    const selected = permissionListValue(formData);
    await updateRole({
      siteId: site.site.id,
      roleId: stringValue(formData, "roleId"),
      name: stringValue(formData, "name"),
      description: optionalString(formData, "description"),
      permissionKeys: selected,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    revalidatePath("/admin/roles");
    revalidatePath("/admin/groups");
    const { messages } = await getRequestI18n(site.settings?.defaultLocale);
    return { ok: true, message: messages.roleUpdated };
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
    const messages = await getActionMessages();
    throw new ForbiddenError(messages.loginToContinue);
  }
  return session;
}

async function requireSite() {
  const site = await getPrimarySiteWithSettings(db);
  if (!site) {
    const messages = await getActionMessages();
    throw new AppError(messages.setupRequired, "setup_required", 503);
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
  return value.trim();
}

function safeReturnPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }
  return value;
}

function pageProtectionLevelValue(formData: FormData, key: string): "none" | "protected" {
  const value = stringValue(formData, key);
  if (value === "none" || value === "protected") {
    return value;
  }
  throw new AppError(`Invalid page protection level: ${value}`, "validation_error", 422);
}

function permissionListValue(formData: FormData) {
  return formData
    .getAll("permission")
    .filter((value): value is string => typeof value === "string")
    .filter((value): value is (typeof permissionKeys)[number] =>
      permissionKeys.includes(value as (typeof permissionKeys)[number])
    );
}

async function actionError(error: unknown): Promise<ActionState> {
  const messages = await getActionMessages();
  if (error instanceof AppError || error instanceof ZodError || error instanceof Error) {
    return { ok: false, message: localizeErrorMessage(error, messages) };
  }
  return { ok: false, message: localizeErrorMessage(error, messages) };
}

async function getActionMessages(defaultLocale?: string | null) {
  const site = defaultLocale ? null : await getPrimarySiteWithSettings(db).catch(() => null);
  const { messages } = await getRequestI18n(defaultLocale ?? site?.settings?.defaultLocale);
  return messages;
}
