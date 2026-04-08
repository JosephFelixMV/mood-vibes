import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, ArrowRight, RotateCcw, Loader2, AlertTriangle, ChevronRight, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import type { Product } from "@/lib/supabase-queries";

const MAX_PROMPT_LENGTH = 150;
const SESSION_KEY = "discover_queue";
const PROMPT_KEY = "discover_prompt";

const EXAMPLE_PROMPTS = [
  "Fun birthday gift for a 15-year-old gamer girl under $50",
  "Unique kitchen gadgets for someone who loves to cook",
  "Outdoor toys for kids under $30",
  "Cozy self-care gifts for a stressed-out friend",
];

function fireGaEvent(action: string, params: Record<string, string>) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", action, { ...params, source: "ai_prompt" });
  }
}

function getSessionQueue(): { ids: string[]; index: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setSessionQueue(ids: string[], index: number) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ids, index }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PROMPT_KEY);
}

// Slight shuffle to avoid static feel on reload
function lightShuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const swapRange = Math.min(3, i);
    const j = i - Math.floor(Math.random() * swapRange);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function Discover() {
  useSEO({
    title: "AI Product Finder — Discover",
    description: "Describe what you're looking for and our AI will find the best matching products for you.",
  });

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [productQueue, setProductQueue] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activePrompt, setActivePrompt] = useState("");
  const [hasResults, setHasResults] = useState(false);
  const [showProtoBanner, setShowProtoBanner] = useState(true);

  // Restore queue from session on mount
  useEffect(() => {
    const saved = getSessionQueue();
    const savedPrompt = sessionStorage.getItem(PROMPT_KEY);
    if (saved && saved.ids.length > 0) {
      setActivePrompt(savedPrompt || "");
      setCurrentIndex(saved.index);
      setTotalCount(saved.ids.length);
      setHasResults(true);
      // Fetch products by IDs
      fetchProductsByIds(saved.ids).then((products) => {
        setProductQueue(products);
      });
    }
  }, []);

  async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .in("id", ids)
      .eq("is_active", true);
    if (error || !data) return [];
    // Preserve the order from AI ranking
    const map = new Map(data.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter(Boolean) as Product[];
  }

  const handleSubmit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    setWarning(null);

    fireGaEvent("ai_discover_search", { prompt: trimmed });

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discover-products`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt: trimmed }),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        fireGaEvent("ai_discover_error", { prompt: trimmed, status: String(resp.status) });
        return;
      }

      const ids: string[] = data.product_ids || [];

      if (ids.length === 0) {
        setError("We couldn't find products matching your description. Try rephrasing — include who it's for, their interests, or a budget.");
        fireGaEvent("ai_discover_no_results", { prompt: trimmed });
        return;
      }

      // Slight shuffle for freshness
      const shuffled = lightShuffle(ids);

      if (ids.length < 3) {
        setWarning("We found a few options, but you might get better results with a more specific description.");
      }

      // Fetch full products
      const products = await fetchProductsByIds(shuffled);
      setProductQueue(products);
      setCurrentIndex(0);
      setTotalCount(products.length);
      setActivePrompt(trimmed);
      setHasResults(true);

      // Save to session
      setSessionQueue(shuffled, 0);
      sessionStorage.setItem(PROMPT_KEY, trimmed);

      fireGaEvent("ai_discover_results", { prompt: trimmed, count: String(products.length) });
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < productQueue.length) {
      setCurrentIndex(nextIndex);
      setSessionQueue(productQueue.map((p) => p.id), nextIndex);
      fireGaEvent("ai_discover_next", { index: String(nextIndex) });
    }
  };

  const handleStartOver = () => {
    clearSession();
    setProductQueue([]);
    setCurrentIndex(0);
    setTotalCount(0);
    setActivePrompt("");
    setHasResults(false);
    setError(null);
    setWarning(null);
    setPrompt("");
    fireGaEvent("ai_discover_start_over", {});
  };

  const handleRefine = () => {
    setPrompt(activePrompt);
    setHasResults(false);
    setProductQueue([]);
    clearSession();
  };

  const currentProduct = productQueue[currentIndex];
  const isQueueEnd = currentIndex >= productQueue.length - 1 && productQueue.length > 0;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="container flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4 flex items-center justify-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <Badge variant="secondary" className="text-xs font-medium">AI-Powered</Badge>
            </div>
            <h1 className="font-heading text-3xl font-extrabold tracking-tight md:text-5xl">
              Find the perfect product
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Describe what you're looking for and we'll find products that match — be as specific as you like.
            </p>
          </motion.div>

          {/* Search input */}
          {!hasResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 w-full max-w-xl"
            >
              <label className="mb-2 block text-left text-sm font-medium text-foreground">
                What are you looking for?
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                    onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSubmit()}
                    placeholder="e.g. Fun birthday gift for a 15-year-old gamer girl under $50"
                    className="pl-10"
                    maxLength={MAX_PROMPT_LENGTH}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !prompt.trim()}
                  className="gap-2 rounded-full px-6"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Tip: include who it's for, their interests, and a budget for the best results</span>
                <span>{prompt.length}/{MAX_PROMPT_LENGTH}</span>
              </div>

              {/* Example prompts */}
              <div className="mt-4 flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
        <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-accent/5 blur-3xl" />
      </section>

      {/* Loading */}
      {isLoading && (
        <section className="container pb-16">
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-card p-10 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-medium">Finding products for you...</p>
            <p className="text-sm text-muted-foreground">This usually takes a few seconds</p>
          </div>
        </section>
      )}

      {/* Error */}
      {error && !isLoading && (
        <section className="container pb-16">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-destructive/20 bg-card p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="font-medium">{error}</p>
            <Button variant="outline" onClick={handleStartOver} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Try Again
            </Button>
          </div>
        </section>
      )}

      {/* Results */}
      {hasResults && !isLoading && currentProduct && (
        <section className="container pb-16">
          {/* Active prompt bar */}
          <div className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Results for:</span>
              <span className="font-medium">"{activePrompt}"</span>
              <Badge variant="secondary" className="ml-1">
                {currentIndex + 1} of {totalCount}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleRefine} className="gap-1 text-xs">
                Refine search
              </Button>
              <Button variant="ghost" size="sm" onClick={handleStartOver} className="gap-1 text-xs">
                <RotateCcw className="h-3.5 w-3.5" /> Start Over
              </Button>
            </div>
          </div>

          {warning && (
            <div className="mx-auto mb-4 max-w-3xl rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
              {warning}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentProduct.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="mx-auto max-w-3xl"
            >
              <ProductCard product={currentProduct} featured />
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mx-auto mt-6 flex max-w-3xl justify-center">
            {isQueueEnd ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">You've seen all matching products!</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleRefine} className="gap-2">
                    Refine my search
                  </Button>
                  <Button onClick={handleStartOver} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Search Again
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={handleNext} size="lg" className="gap-2 rounded-full px-8">
                Discover Next <ChevronRight className="h-5 w-5" />
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
