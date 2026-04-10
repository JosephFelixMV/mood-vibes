import { useSEO } from "@/hooks/useSEO";

export default function Disclosure() {
  useSEO({
    title: "Affiliate Disclosure",
    description: "Affiliate and earnings disclosure for Mood & Vibes.",
  });

  return (
    <div className="container max-w-3xl py-12">
      <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        Affiliate &amp; Earnings Disclosure
      </h1>

      <div className="space-y-5 text-muted-foreground leading-relaxed">
        <p>
          Mood & Vibes ("we," "us," or "our") is a participant in affiliate
          marketing programs. When you click on product links on this website and
          make a purchase, we may receive a commission from the retailer or brand
          at no extra cost to you.
        </p>

        <p>
          We are independently owned and operated. All product recommendations
          are based on our own research and editorial judgment. We are not
          employed by, nor do we directly sell products on behalf of, any brand
          featured on this site.
        </p>

        <p>
          This disclosure is provided in accordance with the Canadian Code of
          Advertising Standards and the Ad Standards Influencer Marketing
          Disclosure Guidelines. Our material connection to brands is limited to
          potential affiliate commission earned through qualifying purchases.
        </p>

        <p>
          Prices, availability, and product details are subject to change. Always
          verify information directly with the retailer before purchasing.
        </p>

        <p>
          If you have any questions about our affiliate relationships, please
          contact us at{" "}
          <span className="font-medium text-foreground">
            hello@moodandvibes.com
          </span>
          .
        </p>
      </div>
    </div>
  );
}
