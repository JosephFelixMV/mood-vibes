Live Site: https://www.mood-and-vibes.com
Business Location: Ontario, Canada
Category: Affiliate Product Discovery Platform

What Is Mood and Vibes?
Mood and Vibes is a affiliate product discovery platform that reimagines how people find products they love. Rather than typing keywords into a search bar and sifting through ads, visitors are presented with curated products surfaced by mood and vibe — a serendipitous, editorial-style shopping experience.
The platform does not sell products directly. Every product shown is linked to a third-party retailer via an affiliate link. When a visitor clicks through and makes a purchase, Mood and Vibes earns a referral commission. The discovery experience is the product.
The Core Concept
Traditional e-commerce is intent-driven: you know what you want, you search for it. Mood and Vibes is discovery-driven: you don't know what you want until you see it. Visitors can browse a daily featured product, explore curated collections by lifestyle category or vibe, and stumble across things they didn't know they needed — the same dopamine hit as a good thrift store find, without leaving home.

Features
🛍️ Product Discovery Experience

Product Tiles — Each product is displayed in a clean card format showing the product image, name, brand, price, and a link to the retailer via an affiliate URL.
Daily Featured Product — A hero product is surfaced prominently each day to drive engagement and return visits.
Random Product Discovery — A dedicated random product tile on the home page and each category landing page lets visitors hit "Discover More" to be served the next randomized product, echoing a "surprise me" browsing mode that breaks from conventional search-and-filter UX.
Rich Product Detail — Each product page includes: primary image, up to 4 additional gallery images, optional MP4 video, HTML-formatted description, and a specifications table (e.g. material, dimensions, care instructions).
Social Sharing — Each product tile includes a share action with pre-populated Open Graph metadata (title, image, description) for clean social previews when shared to platforms like Instagram, Facebook, or iMessage.

🔍 SEO & Discoverability

Structured Metadata — Each product and category page has its own <title>, <meta description>, and Open Graph tags for clean social and search previews.
Default OG Image — A fallback ogdefault.jpg is used for social share previews when no product image is available.
Category Landing Pages — Each Core Lifestyle category has a dedicated, indexable landing page that shows only products from that category, supporting both SEO and focused browsing.

Category & Vibe System

Core Lifestyle Categories — Products are organized into structured lifestyle verticals (e.g. Beauty, Fashion, Home, Kitchen, Fitness, Tech, Outdoors, Pets, Toys, Gaming, Electronics, Books). These anchor browsability and SEO structure.
Vibe Tags — An optional secondary tag layer adds personality and cross-category discoverability (e.g. "Eco", "Cozy", "Minimalist"). Vibes cut across categories, letting users explore by aesthetic or feeling rather than product type.
Filtered Browsing — Visitors can filter by Core Lifestyle category or by Vibe to narrow or shift their discovery experience.

📊 Analytics & Tracking

Affiliate Link Click Tracking — Every affiliate link click is captured as a product_event in the database, enabling attribution and performance reporting.
Product Impression Tracking — An IntersectionObserver-based system fires view events when product tiles enter the viewport, giving impression data without inflating counts on page load.
Admin Analytics Dashboard — A category-grouped analytics view breaks down product performance across Core Lifestyle and Vibe filters, helping identify what resonates with visitors.

🔧 Admin Panel

Product Management (CRUD) — Full create, read, update, and delete interface for products. Includes a live preview panel that renders the product card in real-time as fields are filled in.
Rich Text Description Editor — A WYSIWYG editor supports bold, italic, underline, bullet lists, numbered lists, and paragraphs for polished product copy.
Image Management — Supports one primary image URL plus up to 4 additional gallery image URLs per product.
Video Support — Optional MP4 video URL field per product.
Specifications Table — Structured label/value rows (e.g. "Material → 100% Cotton") can be added to any product.
Active / Draft Toggle — Products can be published or held in draft state before going live.
AI-Powered Category & Keyword Suggestions — When adding a product, admins can trigger an AI suggestion via a Supabase Edge Function (Deno) that calls the Anthropic API (Claude Haiku). The function receives the product name, brand, description, and price, then returns recommended core categories, vibes, moods, and SEO keywords with a confidence score (0–1). Brand-specific hints are pulled from a brand_lookup table in Supabase to improve accuracy for known retailers. Post-processing rules enforce correctness at the edge — luxury fashion items over $1,000 are automatically assigned the The Atelier vibe, beauty and skincare products receive Pure Routine, and cleaning/organising products receive the Fresh Start mood. All suggested keywords are filtered against a drug-territory and medical-claims blocklist before being returned, keeping product copy compliant with Canadian Competition Act advertising standards. The endpoint is admin-gated via JWT + user_roles table check.
Bulk Import via JSON — A structured JSON import template (product-import-template.json) allows batch product entry with schema validation hints, field descriptions, and an example record. Includes built-in affiliate disclosure reminder.
📋 Legal & Compliance

Affiliate Disclosure Banner — A persistent sitewide disclosure banner notifies visitors that the site earns commissions on affiliate purchases, satisfying requirements under the Canadian Competition Act and Ad Standards guidelines.
Privacy Policy — PIPEDA-compliant privacy policy covering data collection, use, and user rights.
Price Accuracy — Displayed prices are for reference only and sourced from retailer listings. Disclaimer language reflects the Competition Bureau's standards on price representation accuracy.
Affiliate Import Template Reminder — The product import template includes a built-in affiliate_disclosure reminder field to flag compliance obligations at the point of data entry.

Architecture
Tech Stack
LayerTechnologyFrontend / App BuilderLovable (React + Vite)Backend / DatabaseSupabase (PostgreSQL + Auth + RLS)Affiliate Link GenerationChirpyest browser extensionDNS / CDNCloudflareHostingLovable (preview) → Cloudflare-proxied production domain
Database (Supabase / PostgreSQL)
Key tables:

products — Core product records: name, company, price, image URL, affiliate URL, category, vibe category, video URL, active flag, timestamps.
product_images — Up to 4 additional gallery images per product, ordered by display_order.
product_specifications — Key/value specification rows per product, ordered by display_order.
product_events — Analytics event log: event type (view, click), product ID, timestamp. Powers the admin dashboard.
categories — Category and vibe definitions used to populate dropdowns and filter UIs. Includes icon, slug, and parent slug to distinguish Core Lifestyle vs. Vibe types.

Row Level Security (RLS) is enforced via Supabase policies. Admin operations require authenticated sessions.
Affiliate Link Pipeline
Chirpyest has no public API. Affiliate links are generated through one of two workflows:

Frontend Architecture
Built on React (via Lovable) with:

TanStack Query — Server state management for product and category fetching, cache invalidation on mutations.
Supabase JS client — Direct database queries from the frontend under RLS policies.
IntersectionObserver — Fires impression events when product tiles enter the visible viewport.
Sonner — Toast notification system for admin feedback.
shadcn/ui + Tailwind CSS — Component library and utility-first styling.

Affiliate Link Disclosure (Legal)
This site operates under Canadian jurisdiction (Ontario). The following compliance items are implemented:

Competition Act — Price representation follows accuracy standards. Prices shown are sourced from retailer listings and may change; disclaimers are present and persistent (not tooltip/hover-only, which is insufficient on mobile and legally risky).
Ad Standards / CASL — A persistent, unavoidable affiliate disclosure banner is shown sitewide. Hover-only tooltips are not used as the sole disclosure mechanism.
PIPEDA — Privacy policy covers data collection (analytics events), third-party links (retailer sites), and user rights.

Note for contributors: All product imports must include a valid affiliate disclosure at the point of entry. The product-import-template.json includes an affiliate_disclosure reminder field for this purpose.

Development Notes

Lovable + Supabase Auth — After any domain migration, update the Supabase Auth Site URL in Dashboard → Authentication → URL Configuration to match the live production domain.
Selector Profiles (Scraper) — Site-specific CSS/JSON selectors for the scraper extension are stored as named profiles. New retail sites require selector tuning before bulk scraping.
React Hashed Classnames — The scraper avoids class-based selectors in favour of JSON-LD, **NEXT_DATA**, heading text search, and paired-children DOM patterns due to React build hashing.
Clean Base Files — When iterative patching causes regressions, revert to the last clean base and re-apply targeted changes rather than patching broken state.

Contributing
This is a private project. Access to the Supabase project, Lovable workspace, and Chirpyest account is required to contribute. Contact the project owner for onboarding.

Built with ☕ in Ontario, Canada.
