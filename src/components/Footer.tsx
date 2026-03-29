import { ShoppingBag, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container flex flex-col items-center gap-4 py-8 text-center text-sm text-muted-foreground md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-2 font-heading font-semibold text-foreground">
          <span className="relative">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <HelpCircle className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 text-accent" />
          </span>
          Bored Shopper
        </div>
        <div className="flex gap-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <Link to="/categories" className="hover:text-foreground">Categories</Link>
          <Link to="/products" className="hover:text-foreground">All Products</Link>
        </div>
        <p>© {new Date().getFullYear()} Bored Shopper. All rights reserved.</p>
      </div>
    </footer>
  );
}
