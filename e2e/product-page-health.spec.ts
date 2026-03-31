import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  affiliate_url: string;
  source_url: string;
  is_active: boolean;
  page_error: boolean;
}

test.describe("Product page health checks", () => {
  let products: Product[] = [];

  test.beforeAll(async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?is_active=eq.true&select=id,name,image_url,affiliate_url,source_url,is_active,page_error`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    products = await res.json();
  });

  test("all active product images load successfully", async ({ page }) => {
    const errors: string[] = [];

    for (const product of products) {
      if (!product.image_url) continue;

      const response = await page.request.head(product.image_url);
      if (!response.ok()) {
        errors.push(`${product.name}: image ${product.image_url} returned ${response.status()}`);
      }
    }

    if (errors.length > 0) {
      console.log("Image errors found:", errors);
    }
    expect(errors).toEqual([]);
  });

  test("all affiliate links resolve to source product pages", async ({ page }) => {
    const errors: string[] = [];

    for (const product of products) {
      if (!product.affiliate_url || product.affiliate_url === "#") continue;
      if (!product.source_url) {
        errors.push(`${product.name}: missing source_url`);
        continue;
      }

      try {
        const response = await page.request.get(product.affiliate_url, {
          maxRedirects: 5,
          timeout: 15000,
        });

        if (response.status() >= 400) {
          errors.push(`${product.name}: affiliate URL returned ${response.status()}`);
          continue;
        }

        // Verify the affiliate link resolves to the same domain as the source URL
        const finalUrl = response.url();
        const sourceHost = new URL(product.source_url).hostname.replace("www.", "");
        const finalHost = new URL(finalUrl).hostname.replace("www.", "");

        if (sourceHost !== finalHost) {
          errors.push(`${product.name}: affiliate resolved to ${finalHost}, expected ${sourceHost}`);
        }
      } catch (e: any) {
        errors.push(`${product.name}: affiliate URL failed: ${e.message}`);
      }
    }

    if (errors.length > 0) {
      console.log("Affiliate link errors found:", errors);
    }
    expect(errors).toEqual([]);
  });

  test("source product pages are still accessible (no 404s)", async ({ page }) => {
    const errors: string[] = [];

    for (const product of products) {
      if (!product.source_url) continue;

      try {
        const response = await page.request.get(product.source_url, {
          maxRedirects: 5,
          timeout: 15000,
        });

        if (response.status() >= 400) {
          errors.push(`${product.name}: source URL ${product.source_url} returned ${response.status()}`);
        }
      } catch (e: any) {
        errors.push(`${product.name}: source URL failed: ${e.message}`);
      }
    }

    if (errors.length > 0) {
      console.log("Source URL errors found:", errors);
    }
    expect(errors).toEqual([]);
  });

  test("product detail pages render without errors", async ({ page }) => {
    const errors: string[] = [];

    for (const product of products.slice(0, 10)) {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(`/product/${product.id}`, { waitUntil: "networkidle" });

      const heading = page.locator("h1");
      await expect(heading).toBeVisible({ timeout: 10000 });

      if (consoleErrors.length > 0) {
        errors.push(`${product.name}: console errors: ${consoleErrors.join("; ")}`);
      }

      page.removeAllListeners("console");
    }

    if (errors.length > 0) {
      console.log("Page render errors:", errors);
    }
    expect(errors).toEqual([]);
  });
});
