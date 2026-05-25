import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShopifyProduct {
  external_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  additional_images: string[];
  external_url: string;
  company_name: string;
}

async function requireAdmin(req: Request, supabaseUrl: string, serviceRoleKey: string) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false as const, status: 401, error: "Missing bearer token" };
  const token = authHeader.slice("Bearer ".length);
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false as const, status: 401, error: "Invalid session" };
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return { ok: false as const, status: 401, error: "Admin role required" };
  return { ok: true as const, userId: userData.user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const shopifyClientId = Deno.env.get("SHOPIFY_CLIENT_ID")!;
    const shopifyClientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
    const shopifyStoreUrl = Deno.env.get("SHOPIFY_STORE_URL")!;

    if (!shopifyClientId || !shopifyClientSecret || !shopifyStoreUrl) {
      return new Response(
        JSON.stringify({ error: "SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, and SHOPIFY_STORE_URL secrets are required" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auth = await requireAdmin(req, supabaseUrl, serviceRoleKey);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange client credentials for an Admin API access token
    const tokenResp = await fetch(`https://${shopifyStoreUrl}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: shopifyClientId,
        client_secret: shopifyClientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!tokenResp.ok) {
      const body = await tokenResp.text();
      console.log("Token exchange error:", tokenResp.status, body);
      throw new Error(`Shopify token exchange failed: ${tokenResp.status} ${tokenResp.statusText} — ${body}`);
    }
    const tokenData = await tokenResp.json();
    const shopifyToken = tokenData.access_token;
    console.log("Token exchange succeeded, scopes:", tokenData.scope);

    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2026-01/graphql.json`;

    const allProducts: ShopifyProduct[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const afterArg = cursor ? `, after: "${cursor}"` : "";
      const query = `{
        products(first: 50${afterArg}) {
          edges {
            node {
              id
              title
              descriptionHtml
              handle
              onlineStoreUrl
              variants(first: 1) {
                edges { node { price } }
              }
              media(first: 5) {
                edges {
                  node {
                    ... on MediaImage {
                      image { url altText }
                    }
                  }
                }
              }
            }
            cursor
          }
          pageInfo { hasNextPage endCursor }
        }
      }`;

      const resp = await fetch(shopifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": shopifyToken,
        },
        body: JSON.stringify({ query }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        console.log("GraphQL error body:", body);
        throw new Error(`Shopify API error: ${resp.status} ${resp.statusText}`);
      }

      const json = await resp.json();

      if (json.errors) {
        throw new Error(`Shopify GraphQL error: ${json.errors[0]?.message ?? "Unknown error"}`);
      }

      const productsData = json.data?.products;
      if (!productsData) {
        throw new Error("Unexpected Shopify response shape");
      }

      for (const edge of productsData.edges) {
        const node = edge.node;
        const mediaImages: string[] = [];
        for (const mediaEdge of (node.media?.edges ?? [])) {
          const url = mediaEdge.node?.image?.url;
          if (url) mediaImages.push(url);
        }

        allProducts.push({
          external_id: node.id,
          name: node.title,
          description: node.descriptionHtml || "",
          price: parseFloat(node.variants?.edges?.[0]?.node?.price ?? "0") || 0,
          image_url: mediaImages[0] ?? null,
          additional_images: mediaImages.slice(1, 5),
          external_url: node.onlineStoreUrl ?? "",
          company_name: "",
        });
      }

      hasNextPage = productsData.pageInfo.hasNextPage;
      cursor = productsData.pageInfo.endCursor ?? null;
    }

    return new Response(JSON.stringify({ products: allProducts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
