import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const bucketId = "product-image-cache";

  // List all files
  const { data: files, error: listError } = await supabase.storage
    .from(bucketId)
    .list("", { limit: 1000 });

  if (listError) {
    return new Response(JSON.stringify({ error: listError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!files || files.length === 0) {
    return new Response(JSON.stringify({ message: "Bucket already empty", deleted: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const paths = files.map((f) => f.name);
  const { error: removeError } = await supabase.storage.from(bucketId).remove(paths);

  if (removeError) {
    return new Response(JSON.stringify({ error: removeError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Now empty the bucket itself
  const { error: bucketError } = await supabase.storage.deleteBucket(bucketId);

  return new Response(
    JSON.stringify({
      message: "Cache cleared",
      deleted: paths.length,
      bucketDeleted: !bucketError,
      bucketError: bucketError?.message || null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
