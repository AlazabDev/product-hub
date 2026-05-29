import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Database, FileJson, FileSpreadsheet, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/export/")({ component: ExportCenter });

type ExportJob = {
  id: string; export_type: string; target: string; format: string;
  status: string; total_rows: number; file_url: string | null;
  created_at: string; completed_at: string | null;
};

const TARGETS = [
  { id: "daftra", label: "Daftra (محاسبي)", icon: FileSpreadsheet, format: "csv", desc: "تصدير المنتجات والأسعار بتنسيق دفترة" },
  { id: "erpnext", label: "ERPNext", icon: Database, format: "csv", desc: "تنسيق ERPNext Item Master" },
  { id: "ai_knowledge", label: "AI Knowledge Base", icon: Sparkles, format: "jsonl", desc: "JSONL لتغذية Azure AI Search/Vector DB" },
  { id: "json_full", label: "JSON كامل", icon: FileJson, format: "json", desc: "كل بيانات المنتجات مع الصور والأسعار" },
  { id: "csv_basic", label: "CSV بسيط", icon: FileSpreadsheet, format: "csv", desc: "AZ Code, الاسم, الوصف, السعر" },
];

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ExportCenter() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    const { data } = await supabase.from("export_jobs").select("*").order("created_at", { ascending: false }).limit(50);
    setJobs((data as ExportJob[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const run = async (target: typeof TARGETS[number]) => {
    setBusy(target.id);
    try {
      let query = supabase.from("products").select("az_code, egs_code, name_ar, name_en, short_description_ar, description_ar, gpc_brick_title, tags, status, updated_at").limit(5000);
      if (statusFilter !== "all") query = query.eq("status", statusFilter as "draft");
      const { data: products, error } = await query;
      if (error) throw error;
      if (!products?.length) { toast.error("لا توجد منتجات للتصدير"); return; }

      const { data: prices } = await supabase.from("prices").select("product_id, selling_price, purchase_price, currency").eq("status", "approved");
      const priceMap = new Map<string, { selling: number | null; purchase: number | null; currency: string }>();
      prices?.forEach((p) => {
        if (!priceMap.has(p.product_id)) priceMap.set(p.product_id, { selling: p.selling_price, purchase: p.purchase_price, currency: p.currency ?? "EGP" });
      });

      let content = ""; let filename = ""; let mime = "";

      if (target.id === "ai_knowledge") {
        content = products.map((p) => JSON.stringify({
          id: p.az_code, title: p.name_ar, title_en: p.name_en,
          content: [p.short_description_ar, p.description_ar].filter(Boolean).join("\n"),
          category: p.gpc_brick_title, tags: p.tags ?? [],
        })).join("\n");
        filename = `ai-knowledge-${Date.now()}.jsonl`; mime = "application/x-ndjson";
      } else if (target.id === "json_full") {
        const enriched = products.map((p) => ({ ...p }));
        content = JSON.stringify({ exported_at: new Date().toISOString(), count: enriched.length, products: enriched }, null, 2);
        filename = `products-full-${Date.now()}.json`; mime = "application/json";
      } else if (target.id === "daftra") {
        const rows = products.map((p) => ({
          code: p.az_code, sku: p.egs_code ?? "", name: p.name_ar, name_en: p.name_en ?? "",
          description: p.short_description_ar ?? "", category: p.gpc_brick_title ?? "",
          unit_price: "", cost: "",
        }));
        content = toCSV(rows); filename = `daftra-export-${Date.now()}.csv`; mime = "text/csv";
      } else if (target.id === "erpnext") {
        const rows = products.map((p) => ({
          item_code: p.az_code, item_name: p.name_ar, item_group: p.gpc_brick_title ?? "All Item Groups",
          stock_uom: "Nos", description: p.description_ar ?? p.short_description_ar ?? "",
          is_sales_item: 1, is_purchase_item: 1,
        }));
        content = toCSV(rows); filename = `erpnext-items-${Date.now()}.csv`; mime = "text/csv";
      } else {
        const rows = products.map((p) => {
          const price = priceMap.get((p as { id?: string }).id ?? "");
          return {
            az_code: p.az_code, name_ar: p.name_ar, name_en: p.name_en ?? "",
            description: p.short_description_ar ?? "", category: p.gpc_brick_title ?? "",
            selling_price: price?.selling ?? "", currency: price?.currency ?? "EGP", status: p.status,
          };
        });
        content = toCSV(rows); filename = `products-${Date.now()}.csv`; mime = "text/csv";
      }

      downloadFile(content, filename, mime);

      await supabase.from("export_jobs").insert({
        export_type: "products", target: target.id, format: target.format,
        status: "completed", total_rows: products.length,
        completed_at: new Date().toISOString(),
      });
      toast.success(`تم تصدير ${products.length} عنصر`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التصدير");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مركز التصدير</h1>
        <p className="text-sm text-muted-foreground">تصدير البيانات بتنسيقات Daftra / ERPNext / AI Knowledge / JSON / CSV</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">فلاتر التصدير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label className="text-sm">حالة المنتج:</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="draft">مسودة</SelectItem>
                <SelectItem value="published">منشور</SelectItem>
                <SelectItem value="archived">مؤرشف</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TARGETS.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded bg-accent/10 grid place-items-center text-accent">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t.label}</CardTitle>
                    <Badge variant="outline" className="mt-1 text-[10px]">{t.format.toUpperCase()}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{t.desc}</p>
                <Button onClick={() => run(t)} disabled={busy !== null} className="w-full">
                  <Download className="size-4 ml-2" />
                  {busy === t.id ? "جاري التصدير…" : "تصدير الآن"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">سجل التصديرات</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>الوقت</TableHead><TableHead>الوجهة</TableHead>
              <TableHead>التنسيق</TableHead><TableHead>عدد الصفوف</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-xs num">{new Date(j.created_at).toLocaleString("ar-EG")}</TableCell>
                  <TableCell>{j.target}</TableCell>
                  <TableCell><Badge variant="outline">{j.format}</Badge></TableCell>
                  <TableCell className="num">{j.total_rows}</TableCell>
                  <TableCell><Badge variant={j.status === "completed" ? "default" : "secondary"}>{j.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!jobs.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد تصديرات بعد</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
