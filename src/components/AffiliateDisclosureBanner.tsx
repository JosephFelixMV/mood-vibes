export default function AffiliateDisclosureBanner() {
  return (
    <div className="border-b bg-muted/50 py-2 text-center text-xs text-muted-foreground">
      <span className="font-medium">Affiliate Disclosure:</span> Surprise Shopper participates in affiliate marketing programs. We may earn a commission if you click a link and make a purchase — at no additional cost to you.{" "}
      <a href="/disclosure" className="underline hover:text-foreground">
        Learn more
      </a>
    </div>
  );
}
