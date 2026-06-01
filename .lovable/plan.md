In `src/components/blog/BlogContentRenderer.tsx`, the single-product embed branch renders:

```tsx
<div className="not-prose my-8 max-w-sm">
  <ProductCard product={products[0]} />
</div>
```

Add `mx-auto` so it centers within the article column:

```tsx
<div className="not-prose my-8 max-w-sm mx-auto">
```

No other changes.