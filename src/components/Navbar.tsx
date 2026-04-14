import { Link, useLocation } from "react-router-dom";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import RegionIndicator from "@/components/RegionIndicator";
import { useRegion } from "@/contexts/RegionContext";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/discover", label: "Discover" },
  { to: "/categories", label: "Categories" },
  { to: "/vibes", label: "Vibes" },
  { to: "/moods", label: "Moods" },
  { to: "/brands", label: "Brands" },
  { to: "/products", label: "All Products" },
];

export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { region, detected, isOverridden, setRegion, clearOverride } = useRegion();

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-md" aria-label="Main navigation">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight">
          <span>Mood & Vibes</span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-2 text-xs font-medium uppercase tracking-widest transition-colors ${
                location.pathname === l.to
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <div className="ml-2 border-l pl-2">
            <RegionIndicator
              region={region}
              detected={detected}
              isOverridden={isOverridden}
              onSelect={setRegion}
              onReset={clearOverride}
            />
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-muted-foreground md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t bg-card px-4 pb-4 md:hidden">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-4 py-3 text-sm font-medium ${
                location.pathname === l.to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 border-t pt-2">
            <RegionIndicator
              region={region}
              detected={detected}
              isOverridden={isOverridden}
              onSelect={setRegion}
              onReset={clearOverride}
            />
          </div>
        </div>
      )}
    </nav>
  );
}
