/** Decode HTML entities like &amp; &lt; &gt; &quot; &#39; and numeric codes */
export function decodeHtmlEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

/** Format a brand name for display: decode entities, replace underscores with spaces, capitalize each word */
export function formatBrandName(name: string): string {
  return decodeHtmlEntities(name)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Clean a brand description: decode HTML entities and trim trailing/leading whitespace */
export function formatBrandDescription(desc: string): string {
  return decodeHtmlEntities(desc).trim();
}

/** Strip all HTML/XML tags from a string and decode entities */
export function stripHtml(html: string): string {
  if (!html) return "";
  // Remove tags, then decode entities, then normalize whitespace
  const stripped = html.replace(/<[^>]*>/g, " ");
  return decodeHtmlEntities(stripped).replace(/\s+/g, " ").trim();
}

/** Trim text to a max length at the last full word boundary, appending an ellipsis. */
export function truncateToMeta(text: string, maxLength = 155): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[.,;:!?\-\s]+$/, "")}…`;
}
