Widen all blog page sections from `max-w-3xl` (~48rem) to `max-w-[70rem]` (~1120px).

## Scope
- `src/pages/BlogPostPage.tsx` — hero, article body, featured products, CTA, footer tags, and any other constrained sections
- `src/pages/BlogIndex.tsx` — grid/list container if currently capped at `max-w-3xl`
- Check for any other blog-related pages or components using `max-w-3xl`

## Technical Detail
Replace Tailwind class `max-w-3xl` with `max-w-[70rem]` (custom 1120px) on every blog layout container. Ensure padding and responsiveness remain intact. No schema or backend changes.