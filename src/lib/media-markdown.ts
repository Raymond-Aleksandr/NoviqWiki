/** Build one Markdown image or file link from user-editable media metadata. */
export function mediaMarkdown(url: string, label: string, image = true): string | null {
  if (/[\u0000-\u001f\u007f]/.test(url)) return null;
  const destination = url.trim();
  if (!destination) return null;
  try {
    const parsed = new URL(destination, "https://noviqwiki.local/");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  const escapedLabel = label.replace(/[\r\n]+/g, " ").replace(/[\\\[\]]/g, "\\$&");
  const escapedDestination = destination.replace(/[\\\s<>"'`()]/g, (character) => {
    // encodeURIComponent deliberately leaves apostrophes and parentheses unchanged.
    if (character === "(") return "%28";
    if (character === ")") return "%29";
    if (character === "'") return "%27";
    return encodeURIComponent(character);
  });
  return `${image ? "!" : ""}[${escapedLabel}](${escapedDestination})`;
}
