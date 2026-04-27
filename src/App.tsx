import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RegionProvider, useRegion } from "@/contexts/RegionContext";
import Navbar from "@/components/Navbar";
import RegionNoticeDialog, {
  wasRegionNoticeDismissed,
  markRegionNoticeDismissed,
} from "@/components/RegionNoticeDialog";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import Categories from "./pages/Categories";
import Vibes from "./pages/Vibes";
import Moods from "./pages/Moods";
import MoodLanding from "./pages/MoodLanding";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import ProtectedRoute from "@/components/ProtectedRoute";
import Disclosure from "./pages/Disclosure";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import CategoryLanding from "./pages/CategoryLanding";
import Discover from "./pages/Discover";
import VibeLanding from "./pages/VibeLanding";
import Brands from "./pages/Brands";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import AffiliateDisclosureBanner from "@/components/AffiliateDisclosureBanner";
import LaunchWelcomeModal from "@/components/LaunchWelcomeModal";
import AnalyticsLoader from "@/components/AnalyticsLoader";

const queryClient = new QueryClient();

const ENZUZO_CONSENT_COOKIES = ["cookies-analytics", "cookies-marketing", "cookies-preferences"];
const ENZUZO_CONSENT_STORAGE_KEYS = [
  "enzuzo-consent",
  "enzuzo-cookie",
  "enzuzo-preferences",
  "enzuzo-categories",
];

function hasStoredEnzuzoConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const hasConsentCookie = document.cookie.split(";").some((entry) => {
      const [rawName, rawValue = ""] = entry.split("=");
      const name = decodeURIComponent(rawName.trim()).toLowerCase();
      const value = decodeURIComponent(rawValue.trim()).toLowerCase();
      return ENZUZO_CONSENT_COOKIES.includes(name) && (value === "true" || value === "false");
    });
    if (hasConsentCookie) return true;

    for (const key of ENZUZO_CONSENT_STORAGE_KEYS) {
      const value = localStorage.getItem(key);
      if (value && value !== "{}" && value !== "[]") {
        return true;
      }
    }
  } catch {
    // localStorage unavailable — don't block the region dialog forever
    return true;
  }
  return false;
}

function isVisibleElement(element: Element): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
}

function isEnzuzoBannerVisible(): boolean {
  if (typeof window === "undefined") return false;
  const selectors = [
    "#ez-cookie-notification",
    "#enzuzo-cookie-notification",
    "#enzuzo-cookiebar",
    "#enzuzo-cc-banner",
    "#enzuzo-root [class*='banner']",
    ".ez-consent [class*='cookie-notification']",
    "[class*='enzuzo'][class*='banner']",
  ];
  return selectors.some((selector) => {
    try {
      return Array.from(document.querySelectorAll(selector)).some(isVisibleElement);
    } catch {
      return false;
    }
  });
}

/**
 * Check whether the Enzuzo cookie banner has been resolved (accepted or declined)
 * and is no longer visibly blocking the page.
 */
function hasEnzuzoConsent(): boolean {
  return hasStoredEnzuzoConsent() && !isEnzuzoBannerVisible();
}

function AppShell() {
  const { detected, setRegion, loading } = useRegion();
  const [showNotice, setShowNotice] = useState(false);
  const [cookieResolved, setCookieResolved] = useState(() => hasEnzuzoConsent());

  // Wait until Enzuzo cookie consent has been resolved (accepted or declined)
  // before allowing the RegionNoticeDialog to open. Otherwise the AlertDialog
  // overlay blocks taps on the cookie banner on mobile.
  useEffect(() => {
    if (cookieResolved) return;
    const interval = window.setInterval(() => {
      if (hasEnzuzoConsent()) {
        setCookieResolved(true);
        window.clearInterval(interval);
      }
    }, 300);
    return () => window.clearInterval(interval);
  }, [cookieResolved]);

  useEffect(() => {
    if (loading) return;
    if (!cookieResolved) return;
    if (detected !== "US") {
      // Always pin non-US visitors to the US catalog (no non-US products yet)
      setRegion("US");
      if (!wasRegionNoticeDismissed()) {
        // Short delay so the cookie banner dismissal animation finishes first
        const t = window.setTimeout(() => setShowNotice(true), 400);
        return () => window.clearTimeout(t);
      }
    }
  }, [detected, loading, setRegion, cookieResolved]);

  const handleContinueUS = () => {
    setRegion("US");
    markRegionNoticeDismissed();
    setShowNotice(false);
  };

  const handleDismiss = () => {
    // Force US region so products remain visible (no non-US catalog yet)
    setRegion("US");
    markRegionNoticeDismissed();
    setShowNotice(false);
  };

  return (
    <>
      <RegionNoticeDialog open={showNotice} onContinueUS={handleContinueUS} onDismiss={handleDismiss} />
      <AnalyticsLoader />
      <div className="flex min-h-screen flex-col">
        <AffiliateDisclosureBanner />
        <Navbar />
        <main id="main-content" className="flex-1">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/vibes" element={<Vibes />} />
            <Route path="/vibes/:slug" element={<VibeLanding />} />
            <Route path="/moods" element={<Moods />} />
            <Route path="/moods/:slug" element={<MoodLanding />} />
            <Route path="/products" element={<Products />} />
            <Route path="/category/:slug" element={<CategoryLanding />} />
            <Route path="/product/:slug" element={<ProductDetail />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="/disclosure" element={<Disclosure />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
        <LaunchWelcomeModal />
      </div>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RegionProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </RegionProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
