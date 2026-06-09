import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const txt = fs.readFileSync("/mnt/user-uploads/Alazab_Catalog_Final.cvs.CSV", "utf8").replace(/^\uFEFF/, "");
const lines = txt.split(/\r?\n/).filter(Boolean);
const headers = lines.shift().split(";");
const cols = ["az_code","egs_code","operational_track","name_ar","name_en","description_ar","description_en","gs1_gpc_brick","gpc_brick_title","gpc_class","gpc_family","gpc_segment","sector_ar","confidence_level"];

const rows = lines.map(l => {
  const parts = l.split(";");
  const r = {};
  cols.forEach((c, i) => r[c] = parts[i]?.trim() || null);
  r.item_type = "product";
  r.status = "needs_review";
  r.source = "catalog_import";
  return r;
}).filter(r => r.az_code && r.name_ar);

console.log("Rows to upsert:", rows.length);
const CHUNK = 200;
let ok = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK);
  const { error, count } = await supa.from("products").upsert(slice, { onConflict: "az_code", count: "exact" });
  if (error) { console.error("chunk", i, error.message); process.exit(1); }
  ok += slice.length;
  process.stdout.write(`\r${ok}/${rows.length}`);
}
console.log("\nDone");
const { count } = await supa.from("products").select("*", { count: "exact", head: true });
console.log("Total products in DB:", count);
