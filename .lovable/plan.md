## Goal

1. Add the "AI-styled images" disclosure info icon to the slide-out product view (`ProductDrawer.tsx`) gallery, matching the existing pattern used on `ProductCard` and `DiscoveryTile`.
2. Fix the mobile behavior so tapping the info icon **toggles** the disclosure open/closed instead of flashing for a split second.

## Why the flash happens

The current implementations wrap a `<button>` in a Radix `Tooltip`. Radix Tooltip is designed for hover/focus on desktop. On touch devices, the tap fires focus → tooltip opens → the synthetic click immediately blurs/dismisses it, so it disappears almost instantly. Tooltip is not the right primitive for tap-to-reveal.

## Fix

Replace the `Tooltip` wrapper around the info icon with a Radix `Popover` (already available at `@/components/ui/popover`). Popover is explicitly click/tap-driven and toggles on each tap, which:
- Works identically on desktop (click to open, click outside or click icon again to close)
- Works correctly on mobile (tap to open, tap again or tap outside to close — no flash)

The icon, position, and disclosure copy stay the same.

## Changes

### `src/components/ProductDrawer.tsx`
- Import `Info` from `lucide-react` and `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover`.
- Inside the `GalleryImage` wrapper (or as a sibling absolute element inside the gallery container, alongside the nav arrows so it sits at `top-2 right-2 z-10`), add a `Popover` with an `Info` icon trigger button.
- Trigger button: small rounded background (`bg-card/80 backdrop-blur-sm p-1`), `aria-label="Image disclosure"`, and `onClick={(e) => e.stopPropagation()}` so it doesn't interfere with gallery swipe/close handlers.
- `PopoverContent` text: *"Some images digitally styled with AI to showcase product aesthetic. Actual product details may vary slightly from scene; please refer to retailer gallery for exact specifications."* — `className="max-w-xs text-xs"`, `side="bottom"`, `align="end"`.

### `src/components/ProductCard.tsx` and `src/components/DiscoveryTile.tsx`
- Swap the existing `Tooltip` wrapper around the disclosure `Info` icon for the same `Popover` pattern so the icon also toggles correctly on mobile across the site (this is the same flashing bug the user is reporting on tiles).
- Keep icon position, styling, and `e.stopPropagation()` on the trigger button intact so card click-through navigation is not affected.

## Out of scope
- No backend, schema, or business-logic changes.
- No copy changes — disclosure text is reused verbatim.
