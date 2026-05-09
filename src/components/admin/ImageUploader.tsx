import { useRef, useState, useCallback } from "react";
import { Upload, Loader2, X, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { uploadProductImage } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
}

export default function ImageUploader({ value, onChange, label, className }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File too large (max 20 MB before resize)");
        return;
      }
      setUploading(true);
      try {
        const url = await uploadProductImage(file);
        onChange(url);
        toast.success("Image uploaded");
      } catch (err: any) {
        toast.error(err?.message || "Upload failed");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [onChange]
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label && <p className="text-sm font-medium">{label}</p>}
      <div
        className={cn(
          "flex gap-3 rounded-md border border-dashed border-border p-3 transition-colors",
          dragOver && "border-primary bg-primary/5"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {value ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-border bg-muted">
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 hover:bg-background"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-border bg-muted text-xs text-muted-foreground">
            No image
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowUrlInput((v) => !v)}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              {showUrlInput ? "Hide URL" : "Paste URL"}
            </Button>
          </div>
          {showUrlInput && (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://..."
            />
          )}
          {!showUrlInput && value && (
            <p className="truncate text-xs text-muted-foreground" title={value}>
              {value}
            </p>
          )}
          {!value && !showUrlInput && (
            <p className="text-xs text-muted-foreground">
              Drop an image here, click Upload, or paste a URL. Auto-resized to WebP.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}