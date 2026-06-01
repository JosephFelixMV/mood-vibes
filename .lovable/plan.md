## Goal
Add an HTML source view to the blog `RichTextEditor` so you can paste/edit raw HTML (including `<div class="ornament">`, `<div class="science-box">`, `<blockquote>`, `<h2>`, `<h3>`, `<ul>`, `[product-embed: …]` markers) directly. The blog renderer already styles these classes via `.blog-prose` / `.blog-content-body` in `src/index.css`, so authored HTML will render correctly on the live post.

## Verified class support (already styled in `src/index.css`)
- `.ornament` — centered decorative divider (line 469+)
- `.science-box` — muted card with "Research" label (line 440+)
- `blockquote` — pull-quote treatment (line 419+)
- `h2` with `::before` ornament, `h3` italic (line 323+, 347+)
- `<ul>` / `<li>` with custom bullets and dividers (line 359+)
- `[product-embed: <uuid>]` inside `<p>` is parsed by `BlogContentRenderer` and replaced with `ProductCard`s

The only registered custom TipTap node is `scienceBox` (maps to `div.science-box`). `div.ornament` is currently not a TipTap node, so in WYSIWYG mode TipTap will strip it — which is exactly why an HTML source mode is needed.

## Changes

### 1. `src/components/RichTextEditor.tsx`
- Add a `mode` state: `"rich" | "html"`.
- Add a toolbar toggle button (lucide `Code2` icon, labeled "HTML") on the right side of the existing toolbar.
- **Rich mode**: existing `EditorContent` UI unchanged.
- **HTML mode**: render a monospace `<Textarea>` (min-h ~400px) pre-filled with the current value. On change, call `onChange(rawHtml)` directly so authored markup (including `div.ornament`, inline classes, `[product-embed: …]`) is preserved verbatim.
- When switching **HTML → Rich**: call `editor.commands.setContent(currentHtml)` so TipTap re-parses. Warn the user (small helper text under the toggle) that switching back to Rich may strip unsupported tags/classes — recommend staying in HTML mode for full-article paste-ins.
- When switching **Rich → HTML**: read `editor.getHTML()` into the textarea.
- Register an additional permissive `Ornament` node (same pattern as `ScienceBox`) so `div.ornament` survives a round-trip through Rich mode for the common case. No toolbar button needed — it's authored via HTML mode.

### 2. No other files
- `BlogContentRenderer.tsx`, `index.css`, and the BlogPostForm wiring stay as-is — the editor already emits a single HTML string via `onChange`, which is what the form persists.

## Technical notes
- Keep the textarea uncontrolled-on-blur style (local state in the editor, push to parent `onChange` on every keystroke is fine — matches current behavior).
- The mode toggle lives entirely inside `RichTextEditor`; consumers (`BlogPostForm`) need no changes.
- No new dependencies — `Code2` is already in `lucide-react` and `Textarea` is already in `@/components/ui/textarea`.

## Out of scope
- HTML sanitization / allowlist (content is authored by trusted admins and already rendered via `dangerouslySetInnerHTML` in `BlogContentRenderer`).
- A live split preview — can be added later if useful.