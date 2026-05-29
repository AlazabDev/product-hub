import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { productId, productData } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicates using multiple criteria
    const duplicates = await findDuplicates(supabase, productId, productData);

    return new Response(
      JSON.stringify({
        success: true,
        productId,
        duplicateCount: duplicates.length,
        duplicates: duplicates,
        hasSuspiciousDuplicates: duplicates.some((d: any) => d.similarity > 0.8),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Duplicate check error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});

async function findDuplicates(supabase: any, productId: string, productData: any) {
  const duplicates: any[] = [];

  // Get the product being checked
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw new Error("Product not found");
  }

  // Check 1: Exact code match
  const { data: codeMatches } = await supabase
    .from("products")
    .select("id, name_ar, name_en, az_code, status")
    .eq("az_code", product.az_code)
    .neq("id", productId);

  if (codeMatches && codeMatches.length > 0) {
    codeMatches.forEach((match: any) => {
      duplicates.push({
        id: match.id,
        name_ar: match.name_ar,
        name_en: match.name_en,
        type: "exact_code_match",
        similarity: 1.0,
        reason: "نفس رمز المنتج",
      });
    });
  }

  // Check 2: Similar names (using Levenshtein distance approximation)
  const { data: allProducts } = await supabase
    .from("products")
    .select("id, name_ar, name_en, az_code, status")
    .neq("id", productId)
    .limit(1000);

  if (allProducts) {
    allProducts.forEach((existing: any) => {
      const similarity = calculateSimilarity(product.name_ar, existing.name_ar);

      if (similarity > 0.75 && !duplicates.find((d) => d.id === existing.id)) {
        duplicates.push({
          id: existing.id,
          name_ar: existing.name_ar,
          name_en: existing.name_en,
          type: "name_similarity",
          similarity: similarity,
          reason: `تشابه في الاسم العربي (${(similarity * 100).toFixed(0)}%)`,
        });
      }
    });
  }

  // Check 3: Same GPC family and description
  const { data: familyMatches } = await supabase
    .from("products")
    .select("id, name_ar, name_en, gpc_family")
    .eq("gpc_family", product.gpc_family)
    .neq("id", productId)
    .limit(50);

  if (familyMatches && familyMatches.length > 0) {
    familyMatches.forEach((match: any) => {
      if (!duplicates.find((d) => d.id === match.id)) {
        duplicates.push({
          id: match.id,
          name_ar: match.name_ar,
          name_en: match.name_en,
          type: "same_family",
          similarity: 0.6,
          reason: "نفس الفئة (GPC)",
        });
      }
    });
  }

  // Sort by similarity descending
  return duplicates.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
}

function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Calculate Levenshtein distance approximation
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: any[] = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }

  return costs[s2.length];
}
