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
