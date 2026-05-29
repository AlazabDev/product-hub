import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalize(s: string | null | undefined) {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "") // arabic diacritics
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccard(a: string, b: string) {
  if (!a || !b) return 0;
  const A = new Set(a.split(" ").filter((w) => w.length >= 2));
  const B = new Set(b.split(" ").filter((w) => w.length >= 2));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / (A.size + B.size - inter);
}

export const scanDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // Reset previous open auto groups
    await supabase
      .from("duplicate_groups")
      .delete()
      .eq("status", "open");

    // --- PRODUCTS ---
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, az_code, egs_code, name_ar, name_en, gpc_family, tags, status")
      .neq("status", "archived");
    if (pErr) throw pErr;

    type Group = { title: string; confidence: number; items: { id: string; reason: string }[] };
    const groups: Group[] = [];
    const seen = new Set<string>();

    // exact az_code dup
    const byAz = new Map<string, typeof products>();
    (products ?? []).forEach((p) => {
      if (!p.az_code) return;
      const k = p.az_code.trim().toUpperCase();
      if (!byAz.has(k)) byAz.set(k, [] as any);
      byAz.get(k)!.push(p);
    });
    byAz.forEach((arr, k) => {
      if (arr.length > 1) {
        groups.push({
          title: `AZ Code مكرر: ${k}`,
          confidence: 100,
          items: arr.map((p) => ({ id: p.id, reason: "نفس AZ Code" })),
        });
        arr.forEach((p) => seen.add(p.id));
      }
    });

    // exact egs_code dup
    const byEgs = new Map<string, typeof products>();
    (products ?? []).forEach((p) => {
      if (!p.egs_code) return;
      const k = p.egs_code.trim().toUpperCase();
      if (!byEgs.has(k)) byEgs.set(k, [] as any);
      byEgs.get(k)!.push(p);
    });
    byEgs.forEach((arr, k) => {
      if (arr.length > 1) {
        groups.push({
          title: `EGS Code مكرر: ${k}`,
          confidence: 100,
          items: arr.map((p) => ({ id: p.id, reason: "نفس EGS Code" })),
        });
        arr.forEach((p) => seen.add(p.id));
      }
    });

    // name similarity within same gpc_family
    const remaining = (products ?? []).filter((p) => !seen.has(p.id));
    const byFamily = new Map<string, typeof products>();
    remaining.forEach((p) => {
      const k = p.gpc_family ?? "_none_";
      if (!byFamily.has(k)) byFamily.set(k, [] as any);
      byFamily.get(k)!.push(p);
    });

    byFamily.forEach((arr) => {
      for (let i = 0; i < arr.length; i++) {
        if (seen.has(arr[i].id)) continue;
        const cluster: { id: string; reason: string }[] = [];
        const baseName = normalize(arr[i].name_ar);
        if (!baseName) continue;
        for (let j = i + 1; j < arr.length; j++) {
          if (seen.has(arr[j].id)) continue;
          const sim = jaccard(baseName, normalize(arr[j].name_ar));
          if (sim >= 0.7) {
            if (!cluster.length) cluster.push({ id: arr[i].id, reason: "أساسي" });
            cluster.push({ id: arr[j].id, reason: `تشابه اسم ${Math.round(sim * 100)}%` });
            seen.add(arr[j].id);
          }
        }
        if (cluster.length > 1) {
          seen.add(arr[i].id);
          groups.push({
            title: `تشابه اسم: ${arr[i].name_ar}`,
            confidence: 80,
            items: cluster,
          });
        }
      }
    });

    // persist groups
    let created = 0;
    const flaggedIds = new Set<string>();
    for (const g of groups) {
      const { data: gRow, error: gErr } = await supabase
        .from("duplicate_groups")
        .insert({ title: g.title, status: "open", confidence_score: g.confidence })
        .select("id")
        .single();
      if (gErr || !gRow) continue;
      const items = g.items.map((it) => ({
        duplicate_group_id: gRow.id,
        product_id: it.id,
        similarity_reason: it.reason,
      }));
      await supabase.from("duplicate_group_items").insert(items);
      g.items.forEach((it) => flaggedIds.add(it.id));
      created++;
    }

    // Flag products with tag 'duplicate_suspected'
    for (const id of flaggedIds) {
      const p = (products ?? []).find((x) => x.id === id);
      const tags = new Set<string>((p?.tags as string[] | null) ?? []);
      tags.add("duplicate_suspected");
      await supabase.from("products").update({ tags: Array.from(tags) }).eq("id", id);
    }

    // --- ASSETS (file name + size) ---
    const { data: assets } = await supabase
      .from("assets")
      .select("id, file_name, file_size")
      .eq("status", "active");
    const byFile = new Map<string, { id: string }[]>();
    (assets ?? []).forEach((a) => {
      const k = `${a.file_name}::${a.file_size ?? 0}`;
      if (!byFile.has(k)) byFile.set(k, []);
      byFile.get(k)!.push({ id: a.id });
    });
    let assetGroups = 0;
    for (const [k, arr] of byFile.entries()) {
      if (arr.length < 2) continue;
      assetGroups++;
    }

    return {
      productGroups: created,
      flaggedProducts: flaggedIds.size,
      assetDuplicateGroups: assetGroups,
    };
  });
