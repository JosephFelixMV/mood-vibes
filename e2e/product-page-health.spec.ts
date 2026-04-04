import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  source_url: string;
  is_active: boolean;
  page_error: boolean;
}

test.describe("Product page health checks", () => {
  let products: Product[] = [];

  test.beforeAll(async () => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?is_active=eq.true&select=id,name,image_url,source_url,is_active,page_error`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
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

  test("all source URLs resolve to the correct product page", async ({ page }) => {
    const errors: string[] = [];

    for (const product of products) {
      if (!product.source_url) {
        errors.push(`${product.name}: missing source_url`);
        continue;
      }

      try {
        // Navigate to the source URL and wait for full load
        const response = await page.goto(product.source_url, {
          waitUntil: "networkidle",
          timeout: 30000,
        });

        // Wait for any JS-based redirects to settle
        await page.waitForTimeout(3000);

        const finalUrl = page.url();
        const statusCode = response?.status() ?? 0;

        // Check for HTTP errors
        if (statusCode >= 400) {
          errors.push(`${product.name}: source URL returned ${statusCode}`);
          continue;
        }

        // Check if redirected to home page
        const finalPath = new URL(finalUrl).pathname.replace(/\/$/, "");
        if (finalPath === "" || finalPath === "/") {
          const sourcePath = new URL(product.source_url).pathname.replace(/\/$/, "");
          if (sourcePath.length > 1) {
            errors.push(
              `${product.name}: redirected to home page (${finalUrl}), expected product page`
            );
            continue;
          }
        }

        // Check for domain mismatch
        const sourceHost = new URL(product.source_url).hostname.replace(/^www\./, "");
        const finalHost = new URL(finalUrl).hostname.replace(/^www\./, "");
        if (sourceHost !== finalHost) {
          errors.push(
            `${product.name}: redirected to different domain (${finalHost}), expected ${sourceHost}`
          );
          continue;
        }

        // Check page content for common 404/not-found indicators
        const bodyText = await page.textContent("body");
        const lower = bodyText?.toLowerCase() ?? "";
        const notFoundPatterns = [
          "page not found",
          "404",
          "this page doesn't exist",
          "no longer available",
          "product not found",
          "item not found",
          "we couldn't find",
          "sorry, we can't find",
        ];

        const matchedPattern = notFoundPatterns.find((p) => lower.includes(p));
        if (matchedPattern) {
          errors.push(
            `${product.name}: page content suggests product not found ("${matchedPattern}")`
          );
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
