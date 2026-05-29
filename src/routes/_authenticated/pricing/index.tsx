import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DollarSign, Search, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pricing/")({
  head: () => ({ meta: [{ title: "محرك التسعير — Alazab PAOP" }] }),
  component: PricingList,
});

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 }).format(n);

function PricingList() {
  const [q, setQ] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["pricing-stats"],
    queryFn: async () => {
      const [{ count: total }, { count: priced }, { data: hist }] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("prices").select("product_id", { count: "exact", head: true }),
        supabase.from("price_history").select("id", { count: "exact", head: true }),
      ]);
      return { total: total ?? 0, priced: priced ?? 0, history: (hist as any)?.length ?? 0 };
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pricing-list", q],
    queryFn: async () => {
      const pq = supabase
        .from("prices")
        .select(
          "id, selling_price, purchase_price, currency, status, source, updated_at, products!inner(id, az_code, name_ar, name_en, egs_code), suppliers(id, name)",
        )
        .order("updated_at", { ascending: false })
        .limit(100);
      const { data, error } = await pq;
      if (error) throw error;
      let list: any[] = data ?? [];
      if (q) {
        const ql = q.toLowerCase();
        list = list.filter(
          (r) =>
            r.products?.name_ar?.toLowerCase().includes(ql) ||
            r.products?.az_code?.toLowerCase().includes(ql) ||
            r.products?.egs_code?.toLowerCase().includes(ql),
        );
      }
      return list;
    },
  });

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="size-6 text-accent" /> محرك التسعير
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          إدارة أسعار البيع والشراء وسجل تغيرات الأسعار
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="إجمالي المنتجات" value={stats?.total ?? 0} />
        <StatCard label="منتجات مسعّرة" value={stats?.priced ?? 0} accent />
        <StatCard
          label="تغطية التسعير"
          value={`${stats?.total ? Math.round((stats.priced / stats.total) * 100) : 0}%`}
        />
      </div>

      <Card className="p-3 surface-elevated border-0">
        <div className="relative">
          <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بكود AZ، EGS، أو اسم المنتج..."
            className="pr-9"
          />
        </div>
      </Card>

      <Card className="surface-elevated border-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs">
              <tr>
                <th className="text-right p-3 font-semibold">كود AZ</th>
                <th className="text-right p-3 font-semibold">المنتج</th>
                <th className="text-right p-3 font-semibold">المورد</th>
                <th className="text-right p-3 font-semibold num">سعر الشراء</th>
                <th className="text-right p-3 font-semibold num">سعر البيع</th>
                <th className="text-right p-3 font-semibold num">الهامش</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    جاري التحميل...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    لا توجد أسعار مطابقة
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const margin =
                    r.selling_price && r.purchase_price
                      ? ((r.selling_price - r.purchase_price) / r.selling_price) * 100
                      : null;
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      <td className="p-3 num text-xs text-accent" dir="ltr">
                        {r.products?.az_code}
                      </td>
                      <td className="p-3">
                        <Link
                          to="/products/$id"
                          params={{ id: r.products.id }}
                          className="hover:text-accent font-medium"
                        >
                          {r.products?.name_ar}
                        </Link>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {r.suppliers?.name ?? "—"}
                      </td>
                      <td className="p-3 num" dir="ltr">
                        {fmt(r.purchase_price)} {r.currency}
                      </td>
                      <td className="p-3 num font-semibold" dir="ltr">
                        {fmt(r.selling_price)} {r.currency}
                      </td>
                      <td className="p-3 num text-xs" dir="ltr">
                        {margin == null ? (
                          "—"
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 ${margin > 0 ? "text-success" : "text-destructive"}`}
                          >
                            {margin > 0 ? (
                              <TrendingUp className="size-3" />
                            ) : (
                              <TrendingDown className="size-3" />
                            )}
                            {margin.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <StatusChip s={r.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <Card
      className={`p-4 surface-elevated border-0 ${accent ? "bg-accent/5 border border-accent/20" : ""}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold num mt-1" dir="ltr">
        {typeof value === "number" ? new Intl.NumberFormat("en-EG").format(value) : value}
      </div>
    </Card>
  );
}

function StatusChip({ s }: { s: string }) {
  const map: Record<string, { l: string; c: string }> = {
    approved: { l: "معتمد", c: "bg-success/15 text-success" },
    pending: { l: "قيد المراجعة", c: "bg-warning/15 text-warning" },
    rejected: { l: "مرفوض", c: "bg-destructive/15 text-destructive" },
  };
  const v = map[s] ?? { l: s, c: "bg-muted" };
  return <span className={`text-[10px] px-2 py-0.5 rounded ${v.c}`}>{v.l}</span>;
}
