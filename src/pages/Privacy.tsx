import { useSEO } from "@/hooks/useSEO";

export default function Privacy() {
  useSEO({
    title: "Privacy Policy",
    description: "Privacy and data notice for Surprise Shopper.",
  });

  return (
    <div className="container max-w-3xl py-12">
      <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        Privacy &amp; Data Notice
      </h1>

      <div className="space-y-5 text-muted-foreground leading-relaxed">
        <p>
          This website may use cookies and third-party analytics tools (such as
          Google Analytics) to understand how visitors use our site. No
          personally identifiable information is collected by Surprise Shopper
          directly.
        </p>

        <p>
          Clicking affiliate links will take you to third-party websites, which
          have their own privacy policies. We are not responsible for the privacy
          practices of those sites.
        </p>

        <p>
          This site complies with Canada's Personal Information Protection and
          Electronic Documents Act (PIPEDA).
        </p>

        <p>
          If you have questions about our privacy practices, please contact us at{" "}
          <span className="font-medium text-foreground">
            hello@surpriseshopper.com
          </span>
          .
        </p>
      </div>
    </div>
  );
}
