import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Loads Google Analytics (GA4) using the Measurement ID stored in the
 * `site_config` table under the `google_analytics_id` key (managed via
 * Admin → Site Configuration → Analytics & Tracking).
 *
 * Enzuzo's auto-blocking script (loaded first in index.html) will gate
 * the gtag.js request until the visitor grants analytics consent.
 */
export default function AnalyticsLoader() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", "google_analytics_id")
        .maybeSingle();

      if (cancelled || error) return;

      const measurementId = data?.value?.trim();
      if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return;

      // Avoid double-injection on hot reloads / re-mounts
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
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}