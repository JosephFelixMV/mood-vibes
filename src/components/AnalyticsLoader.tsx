import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

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
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("key,value")
        .in("key", ["google_analytics_id", "hotjar_id"]);

      if (cancelled || error || !data) return;

      const byKey = Object.fromEntries(
        data.map((row) => [row.key, (row.value ?? "").trim()]),
      ) as Record<string, string>;

      injectGA4(byKey.google_analytics_id);
      injectHotjar(byKey.hotjar_id);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
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