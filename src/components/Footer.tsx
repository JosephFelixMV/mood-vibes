import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t bg-background" aria-label="Site footer">
      <div className="container flex flex-col items-center gap-4 py-8 text-center text-sm text-muted-foreground md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-2 font-heading font-semibold text-foreground">
          Mood & Vibes
        </div>
        <nav aria-label="Footer navigation" className="flex gap-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <Link to="/categories" className="hover:text-foreground">Categories</Link>
          <Link to="/vibes" className="hover:text-foreground">Vibes</Link>
          <Link to="/moods" className="hover:text-foreground">Moods</Link>
          <Link to="/products" className="hover:text-foreground">All Products</Link>
        </nav>
        <div className="flex flex-col items-center gap-2 md:items-end">
          <div className="flex gap-4">
            <Link to="/disclosure" className="hover:text-foreground">Affiliate Disclosure</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          </div>
          <p>© {new Date().getFullYear()} Mood & Vibes. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
