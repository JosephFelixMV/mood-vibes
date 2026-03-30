import { Gift } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container flex flex-col items-center gap-4 py-8 text-center text-sm text-muted-foreground md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-2 font-heading font-semibold text-foreground">
          <Gift className="h-5 w-5 text-primary" />
          Surprise Shopper
        </div>
        <div className="flex gap-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <Link to="/categories" className="hover:text-foreground">Categories</Link>
          <Link to="/vibes" className="hover:text-foreground">Vibes</Link>
          <Link to="/products" className="hover:text-foreground">All Products</Link>
        </div>
        <div className="flex flex-col items-center gap-2 md:items-end">
          <div className="flex gap-4">
            <Link to="/disclosure" className="hover:text-foreground">Affiliate Disclosure</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          </div>
          <p>© {new Date().getFullYear()} Surprise Shopper. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
