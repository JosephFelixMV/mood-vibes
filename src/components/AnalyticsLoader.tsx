import { useEffect } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Loads analytics scripts using IDs stored in the `site_config` table
 * (managed via Admin → Site Configuration → Analytics & Tracking):
 *
 *   - `google_analytics_id`  → Google Analytics 4 (G-XXXXXXXXXX)
 *   - `hotjar_id`            → Hotjar Site ID (numeric) **or** a full
 *                              Hotjar/Contentsquare UXA script URL
 *                              (e.g. https://t.contentsquare.net/uxa/<id>.js
 *                              or https://static.hotjar.com/...).
 *
 * Enzuzo's auto-blocking script (loaded first in index.html) will gate
 * these requests until the visitor grants analytics consent.
 */
export default function AnalyticsLoader() {
  const { data: config } = useSiteConfig();

  useEffect(() => {
    if (!config) return;

    const ga4Id = (config.google_analytics_id ?? "").trim();
    const hotjarId = (config.hotjar_id ?? "").trim();

    const injectAll = () => {
      injectGA4(ga4Id);
      injectHotjar(hotjarId);
      injectGoogleAds("AW-18102407115");
    };

    // Check existing consent on mount (returning visitors who already consented)
    if (hasAnalyticsConsent()) {
      injectAll();
      return;
    }

    // Listen for consent being granted during this session
    const handleConsent = (e: any) => {
      const detail = e?.detail;
      const granted =
        detail?.analytics === true ||
        detail?.categories?.analytics === true ||
        hasAnalyticsConsent();
      if (granted) {
        injectAll();
        cleanup();
      }
    };

    const cleanup = () => {
      window.removeEventListener("enzuzo:consent", handleConsent);
      window.removeEventListener("enzuzo-consent", handleConsent);
    };

    window.addEventListener("enzuzo:consent", handleConsent);
    window.addEventListener("enzuzo-consent", handleConsent);

    return cleanup;
  }, [config]);

  return null;
}

/**
 * Returns true when the visitor has already granted analytics consent via
 * Enzuzo. Checks the Enzuzo runtime API first, then falls back to the
 * `cookies-analytics` cookie that Enzuzo sets after a choice is made.
 */
function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const consent = (window as any).__enzuzo?.getConsent?.();
    if (consent?.analytics === true) return true;
    if (consent?.categories?.analytics === true) return true;
  } catch {
    // ignore — fall back to cookie sniff
  }
  try {
    return document.cookie.split(";").some((entry) => {
      const [rawName, rawValue = ""] = entry.split("=");
      const name = decodeURIComponent(rawName.trim()).toLowerCase();
      const value = decodeURIComponent(rawValue.trim()).toLowerCase();
      return name === "cookies-analytics" && value === "true";
    });
  } catch {
    return false;
  }
}

function injectGA4(measurementId: string | undefined) {
  if (!measurementId) return;
  if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return;
  if (document.getElementById("ga4-loader")) return;

  const loader = document.createElement("script");
  loader.id = "ga4-loader";
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(loader);

  const inline = document.createElement("script");
  inline.id = "ga4-init";
  inline.text = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', '${measurementId}', { anonymize_ip: true });
  `;
  document.head.appendChild(inline);
}

function injectHotjar(rawValue: string | undefined) {
  // placeholder
  void 0;
  return _injectHotjar(rawValue);
}

function injectGoogleAds(conversionId: string) {
  if (!conversionId) return;
  if (document.getElementById("google-ads-loader")) return;

  const loader = document.createElement("script");
  loader.id = "google-ads-loader";
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`;
  document.head.appendChild(loader);

  const inline = document.createElement("script");
  inline.id = "google-ads-init";
  inline.text = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = window.gtag || gtag;
    gtag('js', new Date());
    gtag('config', '${conversionId}');
  `;
  document.head.appendChild(inline);
}

function _injectHotjar(rawValue: string | undefined) {
  if (!rawValue) return;
  if (document.getElementById("hotjar-loader")) return;

  // Support a full script URL pasted from Hotjar/Contentsquare ("UXA"):
  //   https://t.contentsquare.net/uxa/<hash>.js
  //   https://static.hotjar.com/c/hotjar-<id>.js?sv=<n>
  if (/^https?:\/\//i.test(rawValue) && rawValue.endsWith(".js")) {
    const tag = document.createElement("script");
    tag.id = "hotjar-loader";
    tag.async = true;
    tag.src = rawValue;
    document.head.appendChild(tag);
    return;
  }

  // Otherwise treat the value as a numeric Hotjar Site ID and use the
  // classic Hotjar Tracking Code snippet.
  if (!/^\d+$/.test(rawValue)) return;

  const inline = document.createElement("script");
  inline.id = "hotjar-loader";
  inline.text = `
    (function(h,o,t,j,a,r){
        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
        h._hjSettings={hjid:${rawValue},hjsv:6};
        a=o.getElementsByTagName('head')[0];
        r=o.createElement('script');r.async=1;
        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
        a.appendChild(r);
    })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
  `;
  document.head.appendChild(inline);
}