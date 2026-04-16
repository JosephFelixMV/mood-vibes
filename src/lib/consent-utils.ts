const STORAGE_KEY = "cookie_consent";

type ConsentState = { accepted: boolean; analytics: boolean; region: string; timestamp: number };

export function getStoredConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > 365 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  const consent = getStoredConsent();
  return consent?.analytics === true;
}

/**
 * Inject a third-party script into <head> only once.
 * Returns the created <script> element or the existing one.
 */
function injectScript(src: string, id: string): HTMLScriptElement {
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) return existing;
  const script = document.createElement("script");
  script.id = id;
  script.src = src;
  script.async = true;
  document.head.appendChild(script);
  return script;
}

/**
 * Load Google Analytics (gtag.js) with the given measurement ID.
 * Blocked until explicit consent.
 */
export function loadGoogleAnalytics(measurementId: string) {
  if (!measurementId) return;
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${measurementId}`, "ga-script");
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = w.gtag || function gtag(...args: any[]) { w.dataLayer.push(args); };
  w.gtag("js", new Date());
  w.gtag("config", measurementId);
}

/**
 * Load Hotjar with the given site ID.
 * Blocked until explicit consent.
 */
export function loadHotjar(siteId: string) {
  if (!siteId) return;
  const w = window as any;
  w.hj = w.hj || function () { (w.hj.q = w.hj.q || []).push(arguments); };
  w._hjSettings = { hjid: Number(siteId), hjsv: 6 };
  injectScript(`https://static.hotjar.com/c/hotjar-${siteId}.js?sv=6`, "hj-script");
}

/**
 * Load Contentsquare (UXA) tag.
 * Blocked until explicit consent.
 */
export function loadContentsquare(scriptUrl: string) {
  if (!scriptUrl) return;
  injectScript(scriptUrl, "cs-script");
}

/**
 * Remove injected analytics scripts and clear their globals.
 */
export function removeAnalyticsScripts() {
  ["ga-script", "hj-script", "cs-script"].forEach((id) => {
    document.getElementById(id)?.remove();
  });
  const w = window as any;
  delete w.gtag;
  delete w.dataLayer;
  delete w.hj;
  delete w._hjSettings;
  delete w._uxa;
}
