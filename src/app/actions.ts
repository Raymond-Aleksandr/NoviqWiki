"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db/client";
import { getPrimarySiteWithSettings } from "@/db/site";
import { localizeErrorMessage } from "@/i18n/errors";
import { getRequestI18n } from "@/i18n/server";
import { AppError, ForbiddenError } from "@/lib/errors";
import { requirePermission } from "@/modules/authorization/permissions";
import {
  emailVerificationSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
  ownerSetupSchema,
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
import { bootstrapOwner, completeSetup, getSetupMode } from "@/modules/setup/service";
import { normalizeAllowedMediaTypes, updateSiteSettings } from "@/modules/settings/service";
import { unwatchPage, watchPage } from "@/modules/watchlist/service";
import {
  assignUserToGroup,
  createGroup,
  createRole,
  permissionKeys,
  updateGroup,
  updateRole,
  updateUserGroups
} from "@/modules/authorization/permissions";
import { createUser, setUserStatus } from "@/modules/users/service";

export async function setupAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const values = Object.fromEntries(formData.entries());
    const mode = await getSetupMode();
    if (mode === "complete") {
      throw new Error("Setup has already been completed.");
    }
    const setup =
      mode === "owner"
        ? await bootstrapOwner(ownerSetupSchema.parse(values))
        : await completeSetup(setupSchema.parse(values));
    const ownerPassword = String(values.ownerPassword ?? "");
    const session = await login({ identifier: setup.owner.username, password: ownerPassword });
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
    const messages = await getActionMessages();
    return {
      ok: true,
      message: messages.passwordResetSentGeneric
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
    const defaultLocale = localeValue(formData, "defaultLocale");
    await updateSiteSettings({
      siteId: site.site.id,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName,
      values: {
        tagline: stringValue(formData, "tagline"),
        baseUrl: stringValue(formData, "baseUrl"),
        logoUrl: optionalPublicUrl(formData, "logoUrl"),
        faviconUrl: optionalPublicUrl(formData, "faviconUrl"),
        defaultLocale,
        registrationMode: formData.get("registrationMode") as
          "open" | "email_verification" | "invite" | "closed",
        publicMode: formData.get("publicMode") === "on",
        defaultHomepage: stringValue(formData, "defaultHomepage"),
        homepageTitle: stringValue(formData, "homepageTitle"),
        homepageIntro: stringValue(formData, "homepageIntro"),
        homepageFeaturedPages: commaListValue(formData, "homepageFeaturedPages"),
        homepageFeaturedCategories: commaListValue(formData, "homepageFeaturedCategories"),
        homepageSections: {
          search: formData.get("homepageSearch") === "on",
          featured: formData.get("homepageFeatured") === "on",
          recent: formData.get("homepageRecent") === "on",
          categories: formData.get("homepageCategories") === "on",
          layout: homepageLayoutValue(formData, "homepageLayout"),
          showLogo: formData.get("homepageShowLogo") === "on"
        },
        footerContent: optionalString(formData, "footerContent") ?? "",
        uploadMaxBytes: Number(formData.get("uploadMaxBytes") ?? 5242880),
        allowedMediaTypes: normalizeAllowedMediaTypes(stringValue(formData, "allowedMediaTypes")),
        seoTitle: optionalString(formData, "seoTitle") ?? null,
        seoDescription: optionalString(formData, "seoDescription") ?? null
      }
    });
    revalidatePath("/");
    revalidatePath("/admin/settings");
    const { messages } = await getRequestI18n(defaultLocale);
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
    const user = await createUser({
      username: stringValue(formData, "username"),
      email: stringValue(formData, "email"),
      displayName: optionalString(formData, "displayName"),
      password: stringValue(formData, "password"),
      status: "active",
      locale: site.settings?.defaultLocale ?? "en"
    });
    const groupId = optionalString(formData, "groupId");
    if (groupId) {
      await assignUserToGroup(user.id, groupId);
    }
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
    await setUserStatus({
      siteId: site.site.id,
      userId: stringValue(formData, "userId"),
      status: stringValue(formData, "status") as "active" | "suspended" | "pending"
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
    await invalidateUserSessions(stringValue(formData, "userId"));
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
    const group = await createGroup({
      siteId: site.site.id,
      name: stringValue(formData, "name"),
      description: optionalString(formData, "description")
    });
    const roleId = optionalString(formData, "roleId");
    if (roleId) {
      await updateGroup({
        siteId: site.site.id,
        groupId: group.id,
        name: group.name,
        description: group.description,
        roleIds: [roleId],
        actorId: session.user.id,
        actorDisplayName: session.user.displayName
      });
    }
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

function optionalPublicUrl(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return value;
    }
  } catch {
    throw new AppError(`Invalid URL: ${key}`, "validation_error", 422);
  }
  throw new AppError(`Invalid URL: ${key}`, "validation_error", 422);
}

function safeReturnPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }
  return value;
}

function commaListValue(formData: FormData, key: string) {
  return (optionalString(formData, key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function homepageLayoutValue(formData: FormData, key: string): "classic" | "portal" | "compact" {
  const value = stringValue(formData, key);
  if (value === "classic" || value === "portal" || value === "compact") {
    return value;
  }
  throw new AppError(`Invalid homepage layout: ${value}`, "validation_error", 422);
}

function localeValue(formData: FormData, key: string): "en" | "zh-CN" {
  const value = stringValue(formData, key);
  if (value !== "en" && value !== "zh-CN") {
    throw new AppError(`Invalid locale: ${value}`, "validation_error", 422);
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
