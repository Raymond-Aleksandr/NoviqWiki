export function normalizeTitle(title: string) {
  return title.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function slugifyTitle(title: string) {
  const normalized = title
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized || "page";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}
