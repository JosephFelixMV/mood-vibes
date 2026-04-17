import { useSEO } from "@/hooks/useSEO";

export default function Terms() {
  useSEO({
    title: "Terms of Use",
    description: "Terms of Use for Mood & Vibes — global terms governing use of the site.",
  });

  return (
    <div className="container max-w-3xl py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        Terms of Use (Global)
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">Effective Date: April 17, 2026</p>

      <div className="space-y-8 text-muted-foreground leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing Mood &amp; Vibes, you agree to these Terms and all applicable laws. If
            you do not agree, please discontinue use immediately.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            2. Global Affiliate Disclosure
          </h2>
          <p>
            Mood &amp; Vibes participates in affiliate marketing programs. We may earn a
            commission on purchases made through our links, at no additional cost to you. This
            disclosure is intended to comply with the Federal Trade Commission (FTC) in the US
            and the Competition Bureau in Canada.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            3. No Professional Advice
          </h2>
          <p>
            All content is for informational and lifestyle purposes. In the wellness and "mood"
            niche, our content is not a substitute for professional medical, psychological, or
            financial advice. Always consult a qualified professional before making
            health-related purchases.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            4. Limitation of Liability
          </h2>
          <p>
            Mood &amp; Vibes provides information on third-party products but does not sell them
            directly. Any disputes regarding product quality, shipping, or returns must be
            resolved with the specific retailer. To the fullest extent permitted by law, Mood
            &amp; Vibes is not liable for any damages arising from your use of this site or
            linked products.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            5. Governing Law &amp; Jurisdiction
          </h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of the Province
            of Ontario, Canada and the federal laws of Canada applicable therein. You agree to
            submit to the exclusive jurisdiction of the courts located in Ontario for the
            resolution of any disputes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">Contact Us</h2>
          <p>
            Email:{" "}
            <a
              href="mailto:Contact@mood-and-vibes.com"
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              Contact@mood-and-vibes.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
