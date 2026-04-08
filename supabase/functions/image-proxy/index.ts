import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "product-image-cache";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate it looks like a URL
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "Invalid protocol" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Create a deterministic cache key from the URL
    const encoder = new TextEncoder();
    const data = encoder.encode(imageUrl);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Extract extension from URL, default to jpg
    const pathParts = parsed.pathname.split(".");
    let ext = pathParts.length > 1 ? pathParts.pop()!.toLowerCase().split("?")[0] : "jpg";
    if (!["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext)) {
      ext = "jpg";
    }

    const storagePath = `${hash}.${ext}`;

    // Check if already cached via list
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list("", { search: storagePath, limit: 1 });

    if (files && files.length > 0 && files[0].name === storagePath) {
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      return new Response(
        JSON.stringify({ cached: true, url: publicUrlData.publicUrl }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch the image from vendor
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ImageCache/1.0)",
        Accept: "image/*",
      },
    });

    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch image",
          status: imageResponse.status,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentType =
      imageResponse.headers.get("content-type") || "image/jpeg";
    const imageBlob = await imageResponse.blob();

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, imageBlob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Fall back to original URL
      return new Response(
        JSON.stringify({ cached: false, url: imageUrl, error: uploadError.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    return new Response(
      JSON.stringify({ cached: true, url: publicUrlData.publicUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Image proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
