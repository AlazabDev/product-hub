import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search,
  Download,
  Filter,
  X,
  FileSpreadsheet,
  FileJson,
  Sparkles,
  Loader2,
  Plus,
} from "lucide-react";
import { generateProductImages } from "@/lib/product-image-gen.functions";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/products/")({
  head: () => ({ meta: [{ title: "المنتجات والخدمات — Alazab PAOP" }] }),
  component: ProductsList,
});

const PAGE = 50;

interface Filters {
  q: string;
  status: string;
  itemType: string;
  gpcFamily: string;
  sector: string;
  confidence: string;
}

function ProductsList() {
  const [filters, setFilters] = useState<Filters>({
    q: "",
    status: "all",
    itemType: "all",
    gpcFamily: "all",
    sector: "all",
    confidence: "all",
  });
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "az_code",
    "name_ar",
    "name_en",
    "status",
    "gpc_family",
    "sector_ar",
  ]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [genLoading, setGenLoading] = useState(false);
  const genFn = useServerFn(generateProductImages);

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ["product-filter-options"],
    queryFn: async () => {
      const [families, sectors] = await Promise.all([
        supabase.from("products").select("gpc_family").not("gpc_family", "is", null),
        supabase.from("products").select("sector_ar").not("sector_ar", "is", null),
      ]);

      const uniqueFamilies = [
        ...new Set((families.data ?? []).map((r: any) => r.gpc_family)),
      ].filter(Boolean);
      const uniqueSectors = [...new Set((sectors.data ?? []).map((r: any) => r.sector_ar))].filter(
        Boolean,
      );

      return { families: uniqueFamilies, sectors: uniqueSectors };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", filters, page],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          "id, az_code, egs_code, name_ar, name_en, item_type, status, gpc_family, sector_ar, confidence_level",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);

      if (filters.q)
        query = query.or(
          `name_ar.ilike.%${filters.q}%,name_en.ilike.%${filters.q}%,az_code.ilike.%${filters.q}%`,
        );
      if (filters.status !== "all") query = query.eq("status", filters.status as any);
      if (filters.itemType !== "all") query = query.eq("item_type", filters.itemType as any);
      if (filters.gpcFamily !== "all") query = query.eq("gpc_family", filters.gpcFamily);
      if (filters.sector !== "all") query = query.eq("sector_ar", filters.sector);
      if (filters.confidence !== "all") query = query.eq("confidence_level", filters.confidence);

      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE);

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => key !== "q" && value !== "all",
  ).length;

  const clearFilters = () => {
    setFilters({
      q: "",
      status: "all",
      itemType: "all",
      gpcFamily: "all",
      sector: "all",
      confidence: "all",
    });
    setPage(0);
  };

  const exportColumns = [
    { key: "az_code", label: "AZ Code" },
    { key: "egs_code", label: "EGS Code" },
    { key: "name_ar", label: "الاسم عربي" },
    { key: "name_en", label: "الاسم انجليزي" },
    { key: "item_type", label: "النوع" },
    { key: "status", label: "الحالة" },
    { key: "gpc_family", label: "العائلة" },
    { key: "sector_ar", label: "القطاع" },
    { key: "confidence_level", label: "الثقة" },
    { key: "description_ar", label: "الوصف" },
  ];

  const exportData = async (format: "csv" | "json") => {
    setExportLoading(true);
    try {
      let query = supabase
        .from("products")
        .select(selectedColumns.join(", "))
        .eq("status", "approved")
        .order("az_code", { ascending: true });

      if (filters.gpcFamily !== "all") query = query.eq("gpc_family", filters.gpcFamily);
      if (filters.sector !== "all") query = query.eq("sector_ar", filters.sector);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("لا توجد بيانات للتصدير");
        return;
      }

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === "csv") {
        const headers = selectedColumns.map(
          (col) => exportColumns.find((c) => c.key === col)?.label || col,
        );
        const csvRows = [headers.join(",")];
        data.forEach((row: any) => {
          const values = selectedColumns.map((col) => {
            const val = row[col];
            if (val === null || val === undefined) return "";
            const strVal = String(val).replace(/"/g, '""');
            return `"${strVal}"`;
          });
          csvRows.push(values.join(","));
        });
        content = "\uFEFF" + csvRows.join("\n"); // BOM for Excel Arabic support
        filename = `products_export_${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv;charset=utf-8";
      } else {
        content = JSON.stringify(data, null, 2);
        filename = `products_export_${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`تم تصدير ${data.length} بند بنجاح`);
    } catch (error) {
      toast.error("حدث خطا اثناء التصدير");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={<Plus className="size-5" />}
        title="المنتجات والخدمات"
        description={`${total.toLocaleString("en-US")} بند في الكتالوج`}
        actions={
          <>
            <Button asChild className="gap-2">
              <Link to="/products/new">
                <Plus className="size-4" />
                إنشاء بند جديد
              </Link>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={exportLoading}>
                  <Download className="size-4 ml-1" />
                  تصدير
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">اختر الاعمدة للتصدير</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      سيتم تصدير البنود المعتمدة فقط
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {exportColumns.map((col) => (
                        <label key={col.key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedColumns.includes(col.key)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedColumns([...selectedColumns, col.key]);
                              } else {
                                setSelectedColumns(selectedColumns.filter((c) => c !== col.key));
                              }
                            }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => exportData("csv")}
                      disabled={selectedColumns.length === 0 || exportLoading}
                    >
                      <FileSpreadsheet className="size-4 ml-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => exportData("json")}
                      disabled={selectedColumns.length === 0 || exportLoading}
                    >
                      <FileJson className="size-4 ml-1" />
                      JSON
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        }
      />
      <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">


      <Card className="p-4 surface-elevated border-0">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم او AZ Code..."
              value={filters.q}
              onChange={(e) => {
                setFilters({ ...filters, q: e.target.value });
                setPage(0);
              }}
              className="pr-9"
            />
          </div>
          <Select
            value={filters.status}
            onValueChange={(v) => {
              setFilters({ ...filters, status: v });
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="approved">معتمد</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="needs_review">يحتاج مراجعة</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
              <SelectItem value="archived">مؤرشف</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="size-4 ml-1" />
                فلاتر متقدمة
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -left-1 size-5 bg-accent text-accent-foreground text-xs rounded-full grid place-items-center num">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">فلاتر متقدمة</h4>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="size-3 ml-1" />
                      مسح الكل
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">نوع البند</Label>
                    <Select
                      value={filters.itemType}
                      onValueChange={(v) => {
                        setFilters({ ...filters, itemType: v });
                        setPage(0);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="product">منتج</SelectItem>
                        <SelectItem value="service">خدمة</SelectItem>
                        <SelectItem value="bundle">حزمة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">العائلة (GPC)</Label>
                    <Select
                      value={filters.gpcFamily}
                      onValueChange={(v) => {
                        setFilters({ ...filters, gpcFamily: v });
                        setPage(0);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل العائلات</SelectItem>
                        {(filterOptions?.families ?? []).map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">القطاع</Label>
                    <Select
                      value={filters.sector}
                      onValueChange={(v) => {
                        setFilters({ ...filters, sector: v });
                        setPage(0);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل القطاعات</SelectItem>
                        {(filterOptions?.sectors ?? []).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">مستوى الثقة</Label>
                    <Select
                      value={filters.confidence}
                      onValueChange={(v) => {
                        setFilters({ ...filters, confidence: v });
                        setPage(0);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="high">عالي</SelectItem>
                        <SelectItem value="medium">متوسط</SelectItem>
                        <SelectItem value="low">منخفض</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4 ml-1" />
              مسح الفلاتر
            </Button>
          )}
        </div>
      </Card>

      {selectedIds.size > 0 && (
        <Card className="p-3 border-accent/40 bg-accent/5 flex items-center gap-3 flex-wrap">
          <div className="text-sm font-medium">
            <span className="num">{selectedIds.size}</span> بند محدد
          </div>
          <div className="mr-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
              disabled={genLoading}
            >
              مسح التحديد
            </Button>
            <Button
              size="sm"
              disabled={genLoading || selectedIds.size > 20}
              onClick={async () => {
                if (selectedIds.size > 20) {
                  toast.error("الحد الأقصى 20 بند في المرة");
                  return;
                }
                setGenLoading(true);
                try {
                  const res = await genFn({ data: { productIds: Array.from(selectedIds) } });
                  toast.success(`تم توليد ${res.totalGenerated} صورة (${res.totalFailed} فشل)`);
                  setSelectedIds(new Set());
                } catch (e: any) {
                  toast.error(e?.message ?? "فشل التوليد");
                } finally {
                  setGenLoading(false);
                }
              }}
            >
              {genLoading ? (
                <Loader2 className="size-4 ml-1 animate-spin" />
              ) : (
                <Sparkles className="size-4 ml-1" />
              )}
              توليد 3 صور لكل بند
            </Button>
          </div>
        </Card>
      )}

      <Card className="surface-elevated border-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase">
              <tr>
                <th className="p-3 w-10">
                  <Checkbox
                    checked={
                      (data?.rows.length ?? 0) > 0 &&
                      data!.rows.every((r: any) => selectedIds.has(r.id))
                    }
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) data?.rows.forEach((r: any) => next.add(r.id));
                      else data?.rows.forEach((r: any) => next.delete(r.id));
                      setSelectedIds(next);
                    }}
                  />
                </th>
                <th className="text-right p-3 font-semibold">AZ Code</th>
                <th className="text-right p-3 font-semibold">الاسم بالعربي</th>
                <th className="text-right p-3 font-semibold">Name EN</th>
                <th className="text-right p-3 font-semibold">العائلة</th>
                <th className="text-right p-3 font-semibold">القطاع</th>
                <th className="text-right p-3 font-semibold">الثقة</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    جاري التحميل...
                  </td>
                </tr>
              )}
              {!isLoading && data?.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    لا توجد نتائج
                  </td>
                </tr>
              )}
              {data?.rows.map((p: any) => (
                <tr
                  key={p.id}
                  className={`border-t hover:bg-secondary/30 ${selectedIds.has(p.id) ? "bg-accent/5" : ""}`}
                >
                  <td className="p-3">
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(p.id);
                        else next.delete(p.id);
                        setSelectedIds(next);
                      }}
                    />
                  </td>
                  <td className="p-3 num text-xs" dir="ltr">
                    <Link
                      to="/products/$id"
                      params={{ id: p.id }}
                      className="text-accent hover:underline"
                    >
                      {p.az_code}
                    </Link>
                  </td>
                  <td className="p-3">
                    <Link to="/products/$id" params={{ id: p.id }} className="hover:underline">
                      {p.name_ar}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground" dir="ltr">
                    {p.name_en}
                  </td>
                  <td className="p-3 text-xs">{p.gpc_family || "—"}</td>
                  <td className="p-3 text-xs">{p.sector_ar || "—"}</td>
                  <td className="p-3 text-xs">
                    {p.confidence_level && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          p.confidence_level === "high"
                            ? "bg-success/15 text-success"
                            : p.confidence_level === "medium"
                              ? "bg-warning/15 text-warning"
                              : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {p.confidence_level === "high"
                          ? "عالي"
                          : p.confidence_level === "medium"
                            ? "متوسط"
                            : "منخفض"}
                      </span>
                    )}
                    {!p.confidence_level && "—"}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3 border-t bg-secondary/30 text-xs">
          <div className="text-muted-foreground num" dir="ltr">
            Page {page + 1} / {pages || 1} - {total.toLocaleString("en-US")} rows
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              السابق
            </button>
            <button
              onClick={() => setPage(Math.min(pages - 1, page + 1))}
              disabled={page >= pages - 1}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      </Card>
      </div>
    </>
  );
}


function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "معتمد", cls: "bg-success/15 text-success" },
    draft: { label: "مسودة", cls: "bg-muted text-muted-foreground" },
    needs_review: { label: "مراجعة", cls: "bg-warning/15 text-warning" },
    rejected: { label: "مرفوض", cls: "bg-destructive/15 text-destructive" },
    archived: { label: "مؤرشف", cls: "bg-muted text-muted-foreground" },
  };
  const v = map[status] ?? { label: status, cls: "bg-secondary" };
  return <span className={`text-[10px] px-2 py-0.5 rounded ${v.cls}`}>{v.label}</span>;
}
