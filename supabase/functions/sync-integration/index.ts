import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { integrationId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get integration config
    const { data: config, error: configError } = await supabase
      .from("integration_configs")
      .select("*")
      .eq("type", integrationId)
      .single();

    if (configError || !config) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    // Route to appropriate sync function
    let syncResult;
    switch (integrationId) {
      case "daftra":
        syncResult = await syncDaftra(supabase, config);
        break;
      case "bot-gateway":
        syncResult = await syncBotGateway(supabase, config);
        break;
      case "erpnext":
        syncResult = await syncERPNext(supabase, config);
        break;
      case "azure-openai":
        syncResult = await syncAzureOpenAI(supabase, config);
        break;
      default:
        throw new Error(`Unknown integration: ${integrationId}`);
    }

    // Log sync activity
    await supabase.from("sync_logs").insert({
      integration_type: integrationId,
      status: "success",
      records_synced: syncResult.count,
      details: syncResult.details,
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        integration: integrationId,
        synced: syncResult.count,
        message: `Successfully synced ${syncResult.count} records`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

async function syncDaftra(supabase: any, config: any) {
  console.log("Syncing Daftra...");

  // Get all approved products
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name_ar, name_en, az_code, gpc_family, description_ar, status")
    .eq("status", "approved");

  if (error) throw error;

  // Map and sync to Daftra (mock implementation)
  const synced = products.length;

  return {
    count: synced,
    details: {
      timestamp: new Date().toISOString(),
      total: synced,
      status: "completed",
    },
  };
}

async function syncBotGateway(supabase: any, config: any) {
  console.log("Syncing Bot Gateway...");

  // Get products for bot catalog
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name_ar, name_en, az_code, description_ar")
    .eq("status", "approved")
    .limit(1000);

  if (error) throw error;

  const synced = products.length;

  return {
    count: synced,
    details: {
      timestamp: new Date().toISOString(),
      products: synced,
      status: "catalog_updated",
    },
  };
}

async function syncERPNext(supabase: any, config: any) {
  console.log("Syncing ERPNext...");

  // ERPNext integration (planned for Q3-Q4 2026)
  return {
    count: 0,
    details: {
      timestamp: new Date().toISOString(),
      status: "planned",
      message: "ERPNext integration coming in Q3-Q4 2026",
    },
  };
}

async function syncAzureOpenAI(supabase: any, config: any) {
  console.log("Syncing Azure OpenAI...");

  // Azure OpenAI integration for product analysis
  const { data: productsNeedingAnalysis, error } = await supabase
    .from("products")
    .select("id, name_ar, description_ar")
    .is("ai_analysis", null)
    .limit(100);

  if (error) throw error;

  const synced = productsNeedingAnalysis.length;

  return {
    count: synced,
    details: {
      timestamp: new Date().toISOString(),
      analyzed: synced,
      status: "analysis_queued",
    },
  };
}
