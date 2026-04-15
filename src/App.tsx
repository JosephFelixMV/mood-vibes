import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RegionProvider, useRegion } from "@/contexts/RegionContext";
import Navbar from "@/components/Navbar";
import RegionNoticeDialog, { wasRegionNoticeDismissed, markRegionNoticeDismissed } from "@/components/RegionNoticeDialog";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import Categories from "./pages/Categories";
import Vibes from "./pages/Vibes";
import Moods from "./pages/Moods";
import MoodLanding from "./pages/MoodLanding";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Admin from "./pages/Admin";
import Disclosure from "./pages/Disclosure";
import Privacy from "./pages/Privacy";
import CategoryLanding from "./pages/CategoryLanding";
import Discover from "./pages/Discover";
import VibeLanding from "./pages/VibeLanding";
import Brands from "./pages/Brands";
import NotFound from "./pages/NotFound";
import AffiliateDisclosureBanner from "@/components/AffiliateDisclosureBanner";
import CookieConsent from "@/components/CookieConsent";

const queryClient = new QueryClient();

function AppShell() {
  const { detected, setRegion, loading } = useRegion();
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (detected !== "US" && !wasRegionNoticeDismissed()) {
      setShowNotice(true);
    }
  }, [detected, loading]);

  const handleContinueUS = () => {
    setRegion("US");
    markRegionNoticeDismissed();
    setShowNotice(false);
  };

  const handleDismiss = () => {
    // Keep detected region (CA or Intl)
    markRegionNoticeDismissed();
    setShowNotice(false);
  };

  return (
    <>
      <RegionNoticeDialog open={showNotice} onContinueUS={handleContinueUS} onDismiss={handleDismiss} />
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
                <Route path="/admin" element={<Admin />} />
                <Route path="/disclosure" element={<Disclosure />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          <Footer />
          <CookieConsent />
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
