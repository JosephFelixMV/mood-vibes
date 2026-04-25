import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, ArrowRight, RotateCcw, Loader2, AlertTriangle, ChevronRight, Info, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabase";
import { useSEO } from "@/hooks/useSEO";
import type { Product } from "@/lib/supabase-queries";
import { useQuery } from "@tanstack/react-query";

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
  if (typeof window !== "undefined" && (window as any).gtag && localStorage.getItem("cookie_consent")?.includes('"analytics":true')) {
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
  const [weeklyLimit, setWeeklyLimit] = useState(5);
  const [showVerify, setShowVerify] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const pendingPromptRef = useRef<string>("");

  // Site key from site_config
  const { data: turnstileSiteKey } = useQuery({
    queryKey: ["turnstile-site-key"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", "turnstile_site_key")
        .single();
      return data?.value || "";
    },
    staleTime: 1000 * 60 * 30,
  });

  // Fetch configurable weekly limit
  useEffect(() => {
    supabase
      .from("site_config")
      .select("value")
      .eq("key", "ai_weekly_prompt_limit")
      .single()
      .then(({ data }) => {
        if (data?.value) setWeeklyLimit(parseInt(data.value, 10) || 5);
      });
  }, []);

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

  const runDiscover = useCallback(async (trimmed: string, turnstileToken: string) => {
    setIsLoading(true);
    setError(null);
    setWarning(null);

    fireGaEvent("ai_discover_search", { prompt: trimmed });

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "discover-products",
        { body: { prompt: trimmed, turnstile_token: turnstileToken } }
      );

      if (invokeError) {
        setError(invokeError.message || "Something went wrong. Please try again.");
        fireGaEvent("ai_discover_error", { prompt: trimmed, status: "invoke_error" });
        return;
      }

      if (data?.error) {
        setError(data.error);
        fireGaEvent("ai_discover_error", { prompt: trimmed, status: "fn_error" });
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
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    pendingPromptRef.current = trimmed;
    if (turnstileSiteKey) {
      // Show widget; the Turnstile callback triggers runDiscover with the token
      setShowVerify(true);
    } else {
      // No site key configured — call without token (server will reject if required)
      runDiscover(trimmed, "");
    }
  }, [prompt, turnstileSiteKey, runDiscover]);

  // Render Turnstile widget when verification step is active
  useEffect(() => {
    if (!showVerify || !turnstileSiteKey || !turnstileContainerRef.current) return;

    const renderWidget = () => {
      const turnstile = (window as any).turnstile;
      if (!turnstile || !turnstileContainerRef.current) return;

      if (turnstileWidgetIdRef.current) {
        try { turnstile.remove(turnstileWidgetIdRef.current); } catch { /* noop */ }
      }

      turnstileWidgetIdRef.current = turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => {
          setShowVerify(false);
          runDiscover(pendingPromptRef.current, token);
        },
        "error-callback": (errorCode?: string) => {
          console.warn("Turnstile transient error:", errorCode);
        },
        "expired-callback": () => {
          // auto-refresh handles this
        },
        "timeout-callback": () => {
          setShowVerify(false);
          setError("Verification timed out. Please try again.");
        },
        retry: "auto",
        "retry-interval": 2000,
        "refresh-expired": "auto",
        size: "normal",
        theme: "auto",
      });
    };

    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      const waitForTurnstile = () => {
        if ((window as any).turnstile) {
          renderWidget();
        } else {
          setTimeout(waitForTurnstile, 100);
        }
      };
      waitForTurnstile();
    }

    return () => {
      if (turnstileWidgetIdRef.current) {
        try { (window as any).turnstile?.remove(turnstileWidgetIdRef.current); } catch { /* noop */ }
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [showVerify, turnstileSiteKey, runDiscover]);

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
      {/* Prototype banner */}
      {showProtoBanner && (
        <div className="border-b bg-primary/5">
          <div className="container flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">Prototype:</strong> AI Discover is an early feature designed to help you find what you're looking for. Results may vary — we're always improving!
              </span>
            </div>
            <button onClick={() => setShowProtoBanner(false)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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

          {/* Result tile — above the prompt */}
          {hasResults && !isLoading && currentProduct && (
            <div className="mt-8 w-full max-w-3xl">
              {/* Active prompt bar */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
                <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
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
                >
                  <ProductCard product={currentProduct} featured ctaLabel="Discover Brand" />
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="mt-6 flex justify-center">
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
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="mt-8 flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border bg-card p-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-lg font-medium">Finding products for you...</p>
              <p className="text-sm text-muted-foreground">This usually takes a few seconds</p>
            </div>
          )}

          {/* Turnstile verification */}
          {showVerify && !isLoading && (
            <div className="mt-8 flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Quick verification</span>
              </div>
              <div ref={turnstileContainerRef} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowVerify(false)}
                className="text-xs text-muted-foreground"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="mt-8 flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-destructive/20 bg-card p-8">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="font-medium">{error}</p>
              <Button variant="outline" onClick={handleStartOver} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Try Again
              </Button>
            </div>
          )}

          {/* Search input — always visible */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 w-full max-w-xl"
          >
            <label className="mb-2 block text-left text-sm font-medium text-foreground">
              {hasResults ? "Search for something else" : "What are you looking for?"}
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
            <p className="mt-1 text-xs text-muted-foreground/70">
              ⚡ Usage is limited to {weeklyLimit} prompts per week
            </p>

            {/* Example prompts — only when no results */}
            {!hasResults && (
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
            )}
          </motion.div>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-accent/5 blur-3xl" />
      </section>
    </div>
  );
}
