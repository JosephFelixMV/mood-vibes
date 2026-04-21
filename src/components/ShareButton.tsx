import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildShareLink, fireShareEvent, getProductShareUrl, getShareCopy } from "@/lib/share-utils";
import type { SharePlatform } from "@/lib/share-utils";
import type { Product } from "@/lib/supabase-queries";

const platforms: { key: SharePlatform; label: string; icon: string }[] = [
  { key: "pinterest", label: "Pinterest", icon: "📌" },
  { key: "whatsapp", label: "WhatsApp", icon: "💬" },
  { key: "instagram", label: "Instagram", icon: "📷" },
  { key: "facebook", label: "Facebook", icon: "📘" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "copy", label: "Copy Link", icon: "🔗" },
];

interface ShareButtonProps {
  product: Product;
  variant?: "icon" | "full";
}

export default function ShareButton({ product, variant = "icon" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleShare = async (platform: SharePlatform) => {
    fireShareEvent(product, platform);

    if (platform === "copy") {
      const url = getProductShareUrl(product, "copy");
      const text = `${getShareCopy(product)}\n${product.name}\n${url}`;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Failed to copy link");
      }
      return;
    }

    if (platform === "instagram") {
      const url = getProductShareUrl(product, "instagram");
      const caption = `${getShareCopy(product)}\n${product.name}\n${url}`;

      // Mobile: try the native share sheet first (Instagram appears as an option)
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: product.name, text: `${getShareCopy(product)}\n${product.name}`, url });
          setOpen(false);
          return;
        } catch {
          // user cancelled or share failed — fall through to copy+open flow
        }
      }

      // Desktop (or Web Share unavailable): copy caption and open Instagram
      try {
        await navigator.clipboard.writeText(caption);
        toast.success("Caption copied! Paste it in your Story, bio, or DM.");
      } catch {
        toast.error("Couldn't copy caption — please copy the link manually.");
      }
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      setOpen(false);
      return;
    }

    const link = buildShareLink(platform, product);
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "full" ? (
          <Button variant="outline" size="sm" className="gap-2 rounded-full">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        ) : (
          <button
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Share product"
          >
            <Share2 className="h-4 w-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Share via</p>
        {platforms.map((p) => (
          <button
            key={p.key}
            onClick={() => handleShare(p.key)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <span className="text-base">{p.icon}</span>
            {p.label}
            {p.key === "copy" && copied && (
              <Check className="ml-auto h-3.5 w-3.5 text-green-500" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
