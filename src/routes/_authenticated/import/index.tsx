import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { bulkUpsertProducts } from "@/lib/import.functions";

export const Route = createFileRoute("/_authenticated/import/")({ component: ImportCenter });

type Job = {
  id: string;
  import_type: string;
  file_name: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  created_at: string;
};

// Smart column mapping: accept Arabic/English headers from the official catalog file
const COL_MAP: Record<string, string> = {
  "az code": "az_code",
  az_code: "az_code",
  "كود az": "az_code",
  "كود egs": "egs_code",
  egs: "egs_code",
  egs_code: "egs_code",
  "مصدر البند": "source",
  source: "source",
  "المسار التشغيلي": "operational_track",
  operational_track: "operational_track",
  "نوع البند": "item_type",
  item_type: "item_type",
  type: "item_type",
  "حالة الاعتماد": "status",
  status: "status",
  "الاسم بالعربي": "name_ar",
  name_ar: "name_ar",
  "name in english": "name_en",
  name_en: "name_en",
  "الاسم بالانجليزي": "name_en",
  "الوصف بالعربي": "description_ar",
  description_ar: "description_ar",
  "description in english": "description_en",
  description_en: "description_en",
  "gpc brick code": "gs1_gpc_brick",
  gs1_gpc_brick: "gs1_gpc_brick",
  "gpc brick title": "gpc_brick_title",
  gpc_brick_title: "gpc_brick_title",
  "gpc class": "gpc_class",
  gpc_class: "gpc_class",
  "gpc family": "gpc_family",
  gpc_family: "gpc_family",
  "gpc segment": "gpc_segment",
  gpc_segment: "gpc_segment",
  "القطاع بالعربي": "sector_ar",
  sector_ar: "sector_ar",
  "مستوى الثقة": "confidence_level",
  confidence_level: "confidence_level",
};

const TYPE_MAP: Record<string, string> = {
  product: "product",
  منتج: "product",
  service: "service",
  خدمة: "service",
  work_item: "work_item",
  عمل: "work_item",
  material: "material",
  مادة: "material",
  bundle: "bundle",
  حزمة: "bundle",
};
const STATUS_MAP: Record<string, string> = {
  approved: "approved",
  معتمد: "approved",
  "needs review": "needs_review",
  needs_review: "needs_review",
  "يحتاج مراجعة": "needs_review",
  draft: "draft",
  مسودة: "draft",
  rejected: "rejected",
  مرفوض: "rejected",
};

function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = COL_MAP[k.trim().toLowerCase()];
    if (!key) continue;
    let val: unknown = typeof v === "string" ? v.trim() : v;
    if (val === "" || val === null || val === undefined) continue;
    if (key === "item_type") val = TYPE_MAP[String(val).trim().toLowerCase()] ?? "product";
    if (key === "status") val = STATUS_MAP[String(val).trim().toLowerCase()] ?? "needs_review";
    out[key] = val;
  }
  return out;
}

function parseSheet(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        // pick "Catalog" sheet if exists, else first
        const sheetName =
          wb.SheetNames.find((n) => /catalog|كتالوج|بنود/i.test(n)) ?? wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        // Try header row 0; if first row looks like banner, try row 2
        let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const looksMapped =
          rows.length && Object.keys(rows[0]).some((k) => COL_MAP[k.trim().toLowerCase()]);
        if (!looksMapped) {
          rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", range: 2 });
        }
        resolve(rows.map(normalizeRow).filter((r) => r.az_code && r.name_ar));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function ImportCenter() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [importType, setImportType] = useState("products");
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    invalid: number;
    errors: { row: number; az_code?: string; message: string }[];
  } | null>(null);

  const bulk = useServerFn(bulkUpsertProducts);

  const load = async () => {
    const { data } = await supabase
      .from("import_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setJobs((data as Job[]) ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    try {
      const rows = await parseSheet(file);
      if (!rows.length) {
        toast.error("لم يتم العثور على بنود صالحة. تأكد من وجود أعمدة AZ Code والاسم بالعربي.");
        return;
      }
      setAllRows(rows);
      setPreview(rows.slice(0, 10));
      toast.success(`تم تحليل ${rows.length} بند للمعاينة`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل قراءة الملف");
    }
  };

  const runImport = async (dryRun = false) => {
    if (!allRows.length) return toast.error("لا توجد بيانات");
    setBusy(true);
    try {
      if (importType !== "products") {
        toast.info("استيراد المنتجات/الخدمات فقط في هذه النسخة");
        return;
      }
      const res = await bulk({ data: { rows: allRows, fileName, dryRun } });
      setResult(res);
      if (dryRun) toast.success(`فحص: ${res.valid} صالح، ${res.invalid} خطأ`);
      else toast.success(`اكتمل: ${res.inserted} جديد، ${res.updated} محدّث، ${res.invalid} خطأ`);
      if (!dryRun) {
        setPreview(null);
        setAllRows([]);
        setFileName("");
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مركز الاستيراد</h1>
        <p className="text-sm text-muted-foreground">
          ارفع ملف Excel/CSV — يتم التعرف التلقائي على الأعمدة (عربي وإنجليزي) ومزامنة المنتجات
          والخدمات عبر AZ Code.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">رفع ملف</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={importType} onValueChange={setImportType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="products">المنتجات والخدمات</SelectItem>
                <SelectItem value="suppliers" disabled>
                  الموردون (قريباً)
                </SelectItem>
              </SelectContent>
            </Select>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button variant="outline" asChild>
                <span>
                  <FileSpreadsheet className="size-4 ml-2" /> اختيار ملف
                </span>
              </Button>
            </label>
            {fileName && (
              <span className="text-sm text-muted-foreground">
                {fileName} — {allRows.length} بند
              </span>
            )}
          </div>

          {preview && preview.length > 0 && (
            <>
              <div className="border rounded overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview[0]).map((h) => (
                        <TableHead key={h} className="text-xs">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        {Object.values(r).map((v, j) => (
                          <TableCell key={j} className="text-xs max-w-[260px] truncate">
                            {String(v ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => runImport(true)} disabled={busy} variant="outline">
                  {busy ? (
                    <Loader2 className="size-4 ml-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4 ml-2" />
                  )}
                  فحص بدون حفظ
                </Button>
                <Button onClick={() => runImport(false)} disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 ml-2 animate-spin" />
                  ) : (
                    <Upload className="size-4 ml-2" />
                  )}
                  تنفيذ الاستيراد ({allRows.length})
                </Button>
              </div>
            </>
          )}

          {result && (
            <div className="rounded border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex gap-4 flex-wrap font-semibold">
                <span className="text-green-600">جديد: {result.inserted}</span>
                <span className="text-blue-600">محدّث: {result.updated}</span>
                <span className="text-destructive">أخطاء: {result.invalid}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-auto text-xs space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-destructive">
                      <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                      <span>
                        صف {e.row} {e.az_code ? `(${e.az_code})` : ""}: {e.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">سجل عمليات الاستيراد</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الوقت</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الملف</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>صحيح</TableHead>
                <TableHead>خطأ</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-xs num">
                    {new Date(j.created_at).toLocaleString("ar-EG")}
                  </TableCell>
                  <TableCell>{j.import_type}</TableCell>
                  <TableCell className="text-xs">{j.file_name}</TableCell>
                  <TableCell className="num">{j.total_rows}</TableCell>
                  <TableCell className="num text-green-600">{j.valid_rows}</TableCell>
                  <TableCell className="num text-destructive">{j.invalid_rows}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        j.status === "completed"
                          ? "default"
                          : j.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {j.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!jobs.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    لا توجد عمليات بعد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
