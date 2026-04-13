import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseTaxonomyString, stringifyTaxonomyValues } from "@/lib/taxonomy-utils";

interface MultiTagSelectProps {
  value: string; // comma-separated
  options: { name: string; icon: string }[];
  onSave: (value: string) => void;
  className?: string;
}

export function MultiTagSelect({ value, options, onSave, className }: MultiTagSelectProps) {
  const tags = parseTaxonomyString(value);

  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing]);

  const removeTag = (tag: string) => {
    const next = stringifyTaxonomyValues(tags.filter((t) => t !== tag));
    onSave(next);
  };

  const addTag = (tag: string) => {
    if (tags.includes(tag)) return;
    const next = stringifyTaxonomyValues([...tags, tag]);
    onSave(next);
    setSearch("");
  };

  const filtered = options.filter(
    (o) => !tags.includes(o.name) && o.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!editing) {
    return (
      <div
        className={cn("flex flex-wrap gap-1 cursor-pointer rounded px-1 -mx-1 min-h-[28px] items-center hover:bg-muted transition-colors", className)}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {tags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
        {tags.map((t) => {
          const opt = options.find((o) => o.name === t);
          return (
            <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
              {opt?.icon} {t}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative min-w-[180px]", className)}>
      <div className="flex flex-wrap gap-1 rounded-md border border-input bg-background px-2 py-1 min-h-[28px] items-center">
        {tags.map((t) => {
          const opt = options.find((o) => o.name === t);
          return (
            <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
              {opt?.icon} {t}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(t); }}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type to search…"
          className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
      {(search || filtered.length > 0) && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No matching options</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.name}
                type="button"
                onClick={() => addTag(o.name)}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
              >
                {o.icon} {o.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
