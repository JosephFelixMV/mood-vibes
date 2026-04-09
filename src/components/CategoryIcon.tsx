import type { Category } from "@/lib/supabase-queries";

interface CategoryIconProps {
  category: Category;
  className?: string;
  imgClassName?: string;
  emojiClassName?: string;
}

/**
 * Renders a category icon — uses uploaded image (icon_url) if available,
 * otherwise falls back to the emoji text in the `icon` field.
 */
export function CategoryIcon({
  category,
  className = "",
  imgClassName = "h-6 w-6 rounded object-cover",
  emojiClassName = "text-xl",
}: CategoryIconProps) {
  const iconUrl = (category as any).icon_url;

  if (iconUrl) {
    return <img src={iconUrl} alt={category.name} className={`${imgClassName} ${className}`} />;
  }

  return <span className={`${emojiClassName} ${className}`}>{category.icon}</span>;
}
