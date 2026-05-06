import { supabase } from "@/lib/supabase";

const BUCKET = "product-images";
const MAX_EDGE = 1600;
const QUALITY = 0.85;

function publicUrlPrefix(): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl("");
  return data.publicUrl;
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    // Revoke after a tick so img has loaded
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function resizeToWebp(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  // Skip processing for non-raster (e.g. SVG) — just upload as-is
  if (!/^image\/(jpeg|png|webp|avif)$/i.test(file.type)) {
    return { blob: file, ext: file.name.split(".").pop()?.toLowerCase() || "bin", type: file.type || "application/octet-stream" };
  }
  const img = await fileToImage(file);
  const longest = Math.max(img.width, img.height);
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: file, ext: file.name.split(".").pop() || "jpg", type: file.type };
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", QUALITY)
  );
  if (!blob) {
    return { blob: file, ext: file.name.split(".").pop() || "jpg", type: file.type };
  }
  return { blob, ext: "webp", type: "image/webp" };
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function uploadProductImage(file: File): Promise<string> {
  const { blob, ext, type } = await resizeToWebp(file);
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const path = `${yyyy}/${mm}/${uuid()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function isOwnedUploadUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith(publicUrlPrefix());
}

export async function deleteProductImageIfOwned(url: string | null | undefined): Promise<void> {
  if (!isOwnedUploadUrl(url)) return;
  const prefix = publicUrlPrefix();
  const path = url!.slice(prefix.length).replace(/^\/+/, "");
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // Best-effort; don't block the form
  }
}