import { useSEO } from "@/hooks/useSEO";

export default function Privacy() {
  useSEO({
    title: "Privacy & Data Notice",
    description: "Privacy and data notice for Mood & Vibes — global privacy-by-design practices.",
  });

  return (
    <div className="container max-w-3xl py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        Privacy &amp; Data Notice (Global)
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">Effective Date: April 17, 2026</p>

      <div className="space-y-8 text-muted-foreground leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">1. Our Commitment to Data Minimization</h2>
          <p>
            Mood &amp; Vibes operates on a "privacy-by-design" principle. We do not directly collect, store, or sell
            personal identifiers such as your name, email address, or phone number through the public-facing areas of
            this website.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">2. Information We Process</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-foreground">Localization Data:</span> We process your IP address to
              determine your approximate geographic region. This ensures we show you relevant affiliate links and
              products for your specific market (Canada, USA, or International). This data is processed in real-time and
              not stored permanently.
            </li>
            <li>
              <span className="font-medium text-foreground">Analytics:</span> We use third-party tools (such as Google
              Analytics 4) to analyze traffic patterns. This data is anonymized and aggregated.
            </li>
            <li>
              <span className="font-medium text-foreground">Cookies:</span> We use cookies to remember your region and
              track referral commissions. You may manage these via our Cookie Consent banner.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">Regional Privacy Rights</h2>
          <p>
            <span className="font-medium text-foreground">Canada:</span> This site complies with the Personal
            Information Protection and Electronic Documents Act (PIPEDA) and Quebec's Law 25. We do not deploy
            non-essential cookies until you provide explicit consent.
          </p>
          <p>
            <span className="font-medium text-foreground">USA:</span> This site complies with US federal and state
            standards, including the CCPA/CPRA. You have the right to know what categories of data we process. We do not
            sell user data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">Quebec Law 25</h2>
          <p>
            <span className="font-medium text-foreground">Canada:</span> In accordance with Quebec Law 25, you have the
            right to access, correct, and request deletion of any personal information we hold about you by contacting
            our Privacy Officer
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">CASL (Canadian Anti-Spam Legislation)</h2>
          <p>
            <span className="font-medium text-foreground">Canada:</span> "We do not currently send marketing emails. If
            we introduce email communications in the future, we will comply with the Canadian Anti-Spam Legislation
            (CASL) and obtain explicit consent before sending.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-foreground">Contact Our Privacy Officer</h2>
          <p>
            Contact:{" "}
            <a
              href="mailto:Contact@mood-and-vibes.com"
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              Contact@mood-and-vibes.com
            </a>
          </p>
        </section>

        <section id="cookies" className="space-y-3 scroll-mt-24">
          <h2 className="font-heading text-xl font-semibold text-foreground">Cookie Policy</h2>
          <p>
            The detailed list of cookies and tracking technologies used on this site is maintained and kept current by
            our cookie consent provider. You can view and update your preferences at any time via the Manage Cookies
            link in the footer.{" "}
            <a
              href="#manage_cookies"
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              Manage Cookies
            </a>{" "}
            link in the footer.
          </p>
          <div id="__enzuzo-root" className="text-foreground" />
        </section>
      </div>
    </div>
  );
}
