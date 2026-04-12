import { useState, useEffect, useRef } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useRateLimitedAction } from "@/hooks/useRateLimitedAction";

interface ReportBrokenLinkProps {
  productId: string;
  variant?: "icon" | "full";
}

export default function ReportBrokenLink({ productId, variant = "icon" }: ReportBrokenLinkProps) {
  const [submitted, setSubmitted] = useState(false);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const { trigger, cooldown } = useRateLimitedAction(5000);

  // Fetch Turnstile site key from config
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

  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileTokenRef = useRef<string>("");

  // Load Turnstile widget if site key is set
  useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainerRef.current) return;

    // Load Turnstile script if not already loaded
    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => renderWidget();
    } else {
      renderWidget();
    }

    function renderWidget() {
      if (!(window as any).turnstile || !turnstileContainerRef.current) return;
      (window as any).turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => { turnstileTokenRef.current = token; },
        size: "invisible",
      });
    }
  }, [turnstileSiteKey]);

  const handleReport = () => {
    trigger(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("report-product", {
          body: {
            product_id: productId,
            turnstile_token: turnstileTokenRef.current || undefined,
            honeypot: honeypotRef.current?.value || undefined,
          },
        });

        if (error) throw error;
        setSubmitted(true);
        toast.success(data?.message || "Thank you for your report!");
      } catch {
        toast.error("Failed to submit report. Please try again.");
      }
    });
  };

  if (submitted) {
    return variant === "full" ? (
      <Button variant="ghost" size="sm" disabled className="gap-1.5 text-muted-foreground">
        <Flag className="h-3.5 w-3.5" /> Reported
      </Button>
    ) : (
      <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-muted-foreground" aria-label="Already reported">
        <Flag className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <>
      {/* Hidden honeypot field */}
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", opacity: 0 }}
      />
      {/* Invisible Turnstile container */}
      <div ref={turnstileContainerRef} style={{ display: "none" }} />

      {variant === "full" ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReport}
          disabled={cooldown}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
          title="Report broken link"
        >
          <Flag className="h-3.5 w-3.5" /> Report Issue
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleReport}
          disabled={cooldown}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Report broken link"
        >
          <Flag className="h-3.5 w-3.5" />
        </Button>
      )}
    </>
  );
}
