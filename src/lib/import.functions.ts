import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const ITEM_TYPES = [
  "product",
  "service",
  "work_item",
  "material",
  "tool",
  "spare_part",
  "finish_item",
  "custom_unit",
  "supplier_item",
  "package",
  "bundle",
] as const;
const STATUSES = [
  "draft",
  "needs_review",
  "duplicate_suspected",
  "content_incomplete",
  "pricing_incomplete",
  "supplier_pending",
  "approved",
  "rejected",
  "exported",
  "archived",
] as const;

const RowSchema = z.object({
  az_code: z.string().min(1).max(80),
  egs_code: z.string().max(80).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  operational_track: z.string().max(120).optional().nullable(),
  item_type: z.enum(ITEM_TYPES).default("product"),
  status: z.enum(STATUSES).default("needs_review"),
  name_ar: z.string().min(1).max(500),
  name_en: z.string().max(500).optional().nullable(),
  description_ar: z.string().max(8000).optional().nullable(),
  description_en: z.string().max(8000).optional().nullable(),
  gs1_gpc_brick: z.string().max(40).optional().nullable(),
  gpc_brick_title: z.string().max(200).optional().nullable(),
  gpc_class: z.string().max(200).optional().nullable(),
  gpc_family: z.string().max(200).optional().nullable(),
  gpc_segment: z.string().max(200).optional().nullable(),
  sector_ar: z.string().max(200).optional().nullable(),
  confidence_level: z.string().max(40).optional().nullable(),
});

export type ProductImportRow = z.infer<typeof RowSchema>;

export const bulkUpsertProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: unknown[]; fileName?: string; dryRun?: boolean }) => {
    const arr = z.array(z.unknown()).max(10000).parse(input.rows);
    return {
      rows: arr,
      fileName: typeof input.fileName === "string" ? input.fileName.slice(0, 200) : "import.xlsx",
      dryRun: Boolean(input.dryRun),
    };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const errors: { row: number; az_code?: string; message: string }[] = [];
    const valid: ProductImportRow[] = [];

    data.rows.forEach((raw, i) => {
      const parsed = RowSchema.safeParse(raw);
      if (parsed.success) valid.push(parsed.data);
      else
        errors.push({
          row: i + 2,
          az_code: (raw as { az_code?: string })?.az_code,
          message: parsed.error.issues.map((iss) => iss.message).join("; "),
        });
    });

    if (data.dryRun) {
      return {
        total: data.rows.length,
        valid: valid.length,
        invalid: errors.length,
        errors: errors.slice(0, 50),
        inserted: 0,
        updated: 0,
      };
    }

    const { data: job } = await supabaseAdmin
      .from("import_jobs")
      .insert({
        import_type: "products",
        file_name: data.fileName,
        total_rows: data.rows.length,
        valid_rows: valid.length,
        invalid_rows: errors.length,
        status: "processing",
        created_by: userId,
      })
      .select("id")
      .single();

    let inserted = 0;
    let updated = 0;

    // Get existing AZ codes to compute insert vs update counts
    const codes = valid.map((v) => v.az_code);
    const { data: existing } = await supabaseAdmin
      .from("products")
      .select("az_code")
      .in("az_code", codes);
    const existingSet = new Set((existing ?? []).map((r) => r.az_code));

    // Chunked upsert
    const CHUNK = 200;
    for (let i = 0; i < valid.length; i += CHUNK) {
      const slice = valid.slice(i, i + CHUNK).map((r) => ({
        az_code: r.az_code,
        egs_code: r.egs_code ?? null,
        source: r.source ?? "manual",
        operational_track: r.operational_track ?? null,
        item_type: r.item_type,
        status: r.status,
        name_ar: r.name_ar,
        name_en: r.name_en ?? null,
        description_ar: r.description_ar ?? null,
        description_en: r.description_en ?? null,
        gs1_gpc_brick: r.gs1_gpc_brick ?? null,
        gpc_brick_title: r.gpc_brick_title ?? null,
        gpc_class: r.gpc_class ?? null,
        gpc_family: r.gpc_family ?? null,
        gpc_segment: r.gpc_segment ?? null,
        sector_ar: r.sector_ar ?? null,
        confidence_level: r.confidence_level ?? null,
      }));
      const { error } = await supabaseAdmin
        .from("products")
        .upsert(slice, { onConflict: "az_code" });
      if (error) {
        errors.push({ row: i, message: error.message });
        continue;
      }
      for (const r of slice) {
        if (existingSet.has(r.az_code)) updated++;
        else inserted++;
      }
    }

    if (job?.id) {
      await supabaseAdmin
        .from("import_jobs")
        .update({
          status: errors.length === data.rows.length ? "failed" : "completed",
          valid_rows: inserted + updated,
          invalid_rows: errors.length,
          error_log: errors.slice(0, 200),
        })
        .eq("id", job.id);
    }

    return {
      total: data.rows.length,
      valid: valid.length,
      invalid: errors.length,
      inserted,
      updated,
      errors: errors.slice(0, 50),
    };
  });
