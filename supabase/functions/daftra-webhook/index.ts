import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Daftra webhook received:", body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process different webhook events
    const { event, data } = body;

    switch (event) {
      case "invoice.created":
        await handleInvoiceCreated(supabase, data);
        break;
      case "invoice.paid":
        await handleInvoicePaid(supabase, data);
        break;
      case "item.updated":
        await handleItemUpdated(supabase, data);
        break;
      default:
        console.log("Unknown event:", event);
    }

    // Log webhook activity
    await supabase.from("webhook_logs").insert({
      source: "daftra",
      event_type: event,
      payload: body,
      processed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, event: event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
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

async function handleInvoiceCreated(supabase: any, data: any) {
  console.log("Processing invoice created:", data.invoice_id);

  // Create order record in AzProud
  const { error } = await supabase.from("orders").insert({
    daftra_invoice_id: data.invoice_id,
    customer_name: data.customer_name,
    total_amount: data.total,
    currency: data.currency || "SAR",
    status: "pending",
    source: "daftra",
    raw_data: data,
  });

  if (error) {
    console.error("Error creating order:", error);
  }
}

async function handleInvoicePaid(supabase: any, data: any) {
  console.log("Processing invoice paid:", data.invoice_id);

  // Update order status
  const { error } = await supabase
    .from("orders")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("daftra_invoice_id", data.invoice_id);

  if (error) {
    console.error("Error updating order:", error);
  }
}

async function handleItemUpdated(supabase: any, data: any) {
  console.log("Processing item updated:", data.sku);

  // Sync item pricing updates back to AzProud
  const { error } = await supabase
    .from("products")
    .update({
      daftra_price: data.price,
      daftra_cost: data.cost,
      daftra_updated_at: new Date().toISOString(),
    })
    .eq("az_code", data.sku);

  if (error) {
    console.error("Error updating product:", error);
  }
}
