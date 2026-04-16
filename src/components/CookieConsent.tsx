import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoredConsent,
  loadGoogleAnalytics,
  loadHotjar,
  removeAnalyticsScripts,
} from "@/lib/consent-utils";

type Region = "us" | "ca" | "eu" | "other";
type ConsentState = { accepted: boolean; analytics: boolean; region: Region; timestamp: number };

const STORAGE_KEY = "cookie_consent";

function storeConsent(consent: ConsentState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
}

function dispatchConsentEvent(analytics: boolean) {
  window.dispatchEvent(new CustomEvent("cookie_consent_update", { detail: { analytics } }));
}

/**
 * Fetch GA / Hotjar IDs from site_config and inject scripts
 * ONLY when the user has given explicit analytics consent.
 */
async function activateAnalytics() {
  try {
    const { data } = await supabase
      .from("site_config")
      .select("key, value")
      .in("key", ["google_analytics_id", "hotjar_id"]);

    const cfg: Record<string, string> = {};
    data?.forEach((r) => { cfg[r.key] = r.value; });

    if (cfg.google_analytics_id) loadGoogleAnalytics(cfg.google_analytics_id);
    if (cfg.hotjar_id) loadHotjar(cfg.hotjar_id);
  } catch {
    // Non-critical — never block the user experience
  }
}

export default function CookieConsent() {
  const [region, setRegion] = useState<Region | null>(null);
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  useEffect(() => {
    const existing = getStoredConsent();
    if (existing) {
      dispatchConsentEvent(existing.analytics);
      // Only inject scripts if the user previously accepted analytics
      if (existing.analytics) activateAnalytics();
      return;
    }

    // No stored consent → detect region to decide consent model

    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) })
      .then((r) => r.json())
      .then((data) => {
        const country = (data.country_code || "").toUpperCase();
        const euCountries = [
          "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
          "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES",
          "SE","GB","IS","LI","NO","CH",
        ];
        let detected: Region = "other";
        if (country === "US") detected = "us";
        else if (country === "CA") detected = "ca";
        else if (euCountries.includes(country)) detected = "eu";

        setRegion(detected);
        setVisible(true);

        // CCPA (US) = opt-out model → load analytics immediately, user can decline later
        if (detected === "us") {
          setAnalyticsChecked(true);
          dispatchConsentEvent(true);
          activateAnalytics();
        } else {
          // EU (GDPR) / CA (Law 25) / Other = opt-in model → block until explicit consent
          setAnalyticsChecked(false);
        }
      })
      .catch(() => {
        // Fallback to strictest model (EU opt-in)
        setRegion("eu");
        setVisible(true);
        setAnalyticsChecked(false);
      });
  }, []);

  const handleAcceptAll = () => {
    const consent: ConsentState = { accepted: true, analytics: true, region: region || "other", timestamp: Date.now() };
    storeConsent(consent);
    dispatchConsentEvent(true);
    activateAnalytics();
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    const consent: ConsentState = { accepted: true, analytics: false, region: region || "other", timestamp: Date.now() };
    storeConsent(consent);
    dispatchConsentEvent(false);
    removeAnalyticsScripts();
    setVisible(false);
  };

  const handleSavePreferences = () => {
    const consent: ConsentState = { accepted: true, analytics: analyticsChecked, region: region || "other", timestamp: Date.now() };
    storeConsent(consent);
    dispatchConsentEvent(analyticsChecked);
    if (analyticsChecked) {
      activateAnalytics();
    } else {
      removeAnalyticsScripts();
    }
    setVisible(false);
  };

  if (!visible) return null;

  const regionLabel =
    region === "us" ? "🇺🇸 US" : region === "ca" ? "🇨🇦 Canada" : region === "eu" ? "🇪🇺 EU/UK" : "🌍 International";

  const regionNote =
    region === "us"
      ? "Under CCPA, analytics is active by default. You can opt out below."
      : region === "ca"
        ? "Under Quebec Law 25 and PIPEDA, we require your explicit consent before setting non-essential cookies or tracking scripts."
        : region === "eu"
          ? "Under GDPR, we require your explicit consent before setting non-essential cookies."
          : "We require your consent before setting non-essential cookies.";

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 md:p-6" role="dialog" aria-label="Cookie consent" aria-live="polite">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card/95 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 shrink-0 text-primary" />
            <h3 className="font-heading text-sm font-semibold">Cookie Preferences</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {regionLabel}
            </span>
          </div>
          <button onClick={handleEssentialOnly} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Dismiss cookie banner (essential cookies only)">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          We use essential cookies to make this site work.{" "}
          {region === "us"
            ? "Analytics (Google Analytics, Hotjar) is active by default under CCPA. You may opt out at any time."
            : "Analytics scripts (Google Analytics, Hotjar) are blocked by default and only activated after you give explicit consent."
          }{" "}
          <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
        </p>

        <p className="mt-1 text-[11px] italic text-muted-foreground/70">{regionNote}</p>

        {showDetails && (
          <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked disabled className="rounded" />
              <span className="font-medium">Essential</span>
              <span className="text-muted-foreground">— Required for site functionality</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={analyticsChecked}
                onChange={(e) => setAnalyticsChecked(e.target.checked)}
                className="rounded"
              />
              <span className="font-medium">Analytics</span>
              <span className="text-muted-foreground">— Google Analytics, Hotjar (blocked until consent)</span>
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleAcceptAll} className="rounded-full text-xs">
            Accept All
          </Button>
          <Button size="sm" variant="outline" onClick={handleEssentialOnly} className="rounded-full text-xs">
            Essential Only
          </Button>
          {!showDetails ? (
            <Button size="sm" variant="ghost" onClick={() => setShowDetails(true)} className="rounded-full text-xs">
              Customize
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleSavePreferences} className="rounded-full text-xs">
              Save Preferences
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
