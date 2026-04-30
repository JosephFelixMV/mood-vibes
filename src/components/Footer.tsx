import { Link } from "react-router-dom";

function InstagramGradientIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FFD776" />
          <stop offset="10%" stopColor="#F9CE54" />
          <stop offset="25%" stopColor="#F58529" />
          <stop offset="45%" stopColor="#DD2A7B" />
          <stop offset="70%" stopColor="#8134AF" />
          <stop offset="100%" stopColor="#515BD4" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-grad)" />
      <rect x="4.5" y="4.5" width="15" height="15" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="17" cy="7" r="1.1" fill="#fff" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="border-t bg-background" aria-label="Site footer">
      <div className="container flex flex-col items-center gap-4 py-8 text-center text-sm text-muted-foreground md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-2 font-heading font-semibold text-foreground">Mood & Vibes</div>
        <nav aria-label="Footer navigation" className="flex gap-6">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <Link to="/categories" className="hover:text-foreground">
            Categories
          </Link>
          <Link to="/vibes" className="hover:text-foreground">
            Vibes
          </Link>
          <Link to="/moods" className="hover:text-foreground">
            Moods
          </Link>
          <Link to="/products" className="hover:text-foreground">
            Products
          </Link>
        </nav>
        <div className="flex flex-col items-center gap-2 md:items-end">
          <div className="flex gap-4">
            <Link to="/disclosure" className="hover:text-foreground">
              Affiliate Disclosure
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms of Use
            </Link>
            <Link to="/about" className="hover:text-foreground">
              About
            </Link>
            <a
              href="#manage_cookies"
              id="manage_cookies"
              className="hover:text-foreground underline-offset-2 hover:underline"
            >
              Manage Cookies
            </a>
            <a
              href="https://www.instagram.com/mnvbrands/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Mood & Vibes on Instagram"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <InstagramGradientIcon className="h-4 w-4" />
              <span>Instagram</span>
            </a>
          </div>
          <p>© {new Date().getFullYear()} Mood & Vibes. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
