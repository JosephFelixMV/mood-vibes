import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function About() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, #EEEDFE 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-2xl mx-auto px-6 pt-20 pb-16 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-6"
            style={{ background: "#EEEDFE" }}
          >
            ✦
          </div>
          <span
            className="inline-block text-[11px] font-medium tracking-[0.08em] uppercase px-3 py-1 rounded-full mb-4"
            style={{ color: "#534AB7", background: "#EEEDFE" }}
          >
            Proof of Concept
          </span>
          <h1 className="text-3xl sm:text-4xl font-medium leading-snug mb-5" style={{ color: "var(--foreground)" }}>
            Find your mood.
            <br />
            Shop the vibe.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Mood &amp; Vibes is a product discovery platform that organises affiliate products by mood, vibe, and
            lifestyle — not by keyword search or category grids. We're in early access, adding new finds daily.
          </p>
        </div>
      </section>

      {/* What it is */}
      <section className="max-w-2xl mx-auto px-6 py-14">
        <h2 className="text-lg font-medium mb-3" style={{ color: "var(--foreground)" }}>
          What is Mood &amp; Vibes?
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          We built Mood &amp; Vibes because product discovery on the internet is broken. You know the <em>feeling</em>{" "}
          you're after — cosy Sunday morning, clean desk energy, coastal summer — but search engines don't speak that
          language.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Instead of browsing by category, you browse by vibe. Every product is curated and tagged to a mood or
          lifestyle moment so you can discover things that actually match how you're feeling right now.
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-2xl mx-auto px-6">
        <hr className="border-border" />
      </div>

      {/* Early access note */}
      <section className="max-w-2xl mx-auto px-6 py-14">
        <div className="rounded-2xl p-6" style={{ background: "#EEEDFE", border: "0.5px solid #C8C4F5" }}>
          <span
            className="inline-block text-[10px] font-semibold tracking-[0.1em] uppercase mb-3"
            style={{ color: "#534AB7" }}
          >
            A note from the team
          </span>
          <p className="text-sm leading-relaxed mb-2" style={{ color: "#2E2A6E" }}>
            This is a prototype. You may notice the occasional gap in our collections, a missing image, or a product
            that doesn't quite fit the vibe. That's part of the process — we're building this in the open, and we're
            adding new finds every day.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "#2E2A6E" }}>
            See something off? Want to see a specific vibe or brand? We want to hear from you — this is being built for
            you.
          </p>
        </div>
          <p className="text-sm leading-relaxed" style={{ color: "#2E2A6E" }}>
            Collaborate with Us
            Interested in sharing your product reviews? please reach out to us at contact@mood-and-vibes.com.          
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-2xl mx-auto px-6">
        <hr className="border-border" />
      </div>

      {/* Affiliate disclosure summary */}
      <section className="max-w-2xl mx-auto px-6 py-14">
        <h2 className="text-lg font-medium mb-3" style={{ color: "var(--foreground)" }}>
          Affiliate links
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Some links on Mood &amp; Vibes are affiliate links. This means we may earn a small commission if you make a
          purchase — at no extra cost to you. It's how we keep the lights on while the site is free to use. We only
          feature products we'd actually recommend..{" "}
          <Link to="/disclosure" className="underline underline-offset-2" style={{ color: "#534AB7" }}>
            Read our full disclosure →
          </Link>
        </p>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 pb-20 text-center">
        <Button asChild className="font-medium px-8" style={{ background: "#534AB7", color: "#fff" }}>
          <Link to="/">Start exploring</Link>
        </Button>
      </section>
    </main>
  );
}
