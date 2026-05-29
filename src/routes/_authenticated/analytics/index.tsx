import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BarChart3, Package, DollarSign, Truck, Sparkles, CheckCircle2, Network, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics/")({
  head: () => ({ meta: [{ title: "التحليلات — Alazab PAOP" }] }),
  component: AnalyticsPage,
});

const STATUS_COLORS: Record<string, string> = {
  approved: "hsl(var(--success))",
  draft: "hsl(var(--muted-foreground))",
  needs_review: "hsl(var(--warning))",
  content_incomplete: "hsl(var(--destructive))",
  rejected: "hsl(var(--destructive))",
  archived: "hsl(var(--muted))",
  duplicate_suspected: "hsl(var(--accent))",
};

function KPI({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-5 surface-elevated border-0">
      <div className="flex items-center justify-between">
        <div className="size-10 rounded-lg bg-accent/15 grid place-items-center">
          <Icon className="size-5 text-accent" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold num" dir="ltr">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </Card>
  );
}

function AnalyticsPage() {
  const { data: stats } = useQuery({
    queryKey: ["analytics-stats"],
    queryFn: async () => {
      const [
        { count: totalProducts },
        { count: approvedProducts },
        { count: needsReview },
        { count: totalSuppliers },
        { count: totalPrices },
        { count: totalAssets },
        { count: pendingApprovals },
        { count: apiConsumers },
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("products").select("*", { count: "exact", head: true }).in("status", ["needs_review", "content_incomplete"]),
        supabase.from("suppliers").select("*", { count: "exact", head: true }),
        supabase.from("prices").select("*", { count: "exact", head: true }),
        supabase.from("assets").select("*", { count: "exact", head: true }),
        supabase.from("approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("api_consumers").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);
      return { totalProducts, approvedProducts, needsReview, totalSuppliers, totalPrices, totalAssets, pendingApprovals, apiConsumers };
    },
  });

  const { data: statusBreakdown = [] } = useQuery({
    queryKey: ["analytics-status"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("status").limit(5000);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((p) => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
      return Object.entries(counts).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] ?? "hsl(var(--primary))" }));
    },
  });

  const { data: priceTrend = [] } = useQuery({
    queryKey: ["analytics-price-trend"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase.from("price_history")
        .select("created_at, old_price, new_price")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });
      const byDay: Record<string, { changes: number; avg_delta: number; total: number }> = {};
      (data ?? []).forEach((r) => {
        const day = new Date(r.created_at).toISOString().slice(0, 10);
        const delta = Number(r.new_price ?? 0) - Number(r.old_price ?? 0);
        const ex = byDay[day] ?? { changes: 0, avg_delta: 0, total: 0 };
        ex.changes++; ex.total += delta;
        ex.avg_delta = ex.total / ex.changes;
        byDay[day] = ex;
      });
      return Object.entries(byDay).map(([day, v]) => ({ day: day.slice(5), changes: v.changes, avg_delta: Math.round(v.avg_delta) }));
    },
  });

  const { data: supplierPerf = [] } = useQuery({
    queryKey: ["analytics-suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("prices")
        .select("supplier_id, selling_price, suppliers(name)").not("supplier_id", "is", null).limit(2000);
      const map: Record<string, { name: string; count: number; avg: number; total: number }> = {};
      (data ?? []).forEach((r: { supplier_id: string | null; selling_price: number | null; suppliers: { name: string } | null }) => {
        if (!r.supplier_id || !r.suppliers) return;
        const ex = map[r.supplier_id] ?? { name: r.suppliers.name, count: 0, avg: 0, total: 0 };
        ex.count++; ex.total += Number(r.selling_price ?? 0);
        ex.avg = ex.total / ex.count;
        map[r.supplier_id] = ex;
      });
      return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 8)
        .map((s) => ({ name: s.name.slice(0, 15), products: s.count, avg_price: Math.round(s.avg) }));
    },
  });

  const { data: apiUsage = [] } = useQuery({
    queryKey: ["analytics-api"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 14);
      const { data } = await supabase.from("webhook_logs")
        .select("created_at, status_code")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true })
        .limit(5000);
      const byDay: Record<string, { calls: number; errors: number }> = {};
      (data ?? []).forEach((r) => {
        const day = new Date(r.created_at).toISOString().slice(0, 10);
        const ex = byDay[day] ?? { calls: 0, errors: 0 };
        ex.calls++;
        if ((r.status_code ?? 0) >= 400) ex.errors++;
        byDay[day] = ex;
      });
      return Object.entries(byDay).map(([day, v]) => ({ day: day.slice(5), ...v }));
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1500px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="size-6 text-accent" /> لوحة التحليلات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة شاملة على أداء الكتالوج والأسعار والموردين وحركة الـ API</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={Package} label="إجمالي البنود" value={stats?.totalProducts ?? "—"} sub={`${stats?.approvedProducts ?? 0} معتمد`} />
        <KPI icon={AlertTriangle} label="بحاجة لمراجعة" value={stats?.needsReview ?? "—"} sub="مسودات + مراجعة" />
        <KPI icon={Truck} label="الموردون" value={stats?.totalSuppliers ?? "—"} />
        <KPI icon={DollarSign} label="سجلات تسعير" value={stats?.totalPrices ?? "—"} />
        <KPI icon={Sparkles} label="أصول مرفوعة" value={stats?.totalAssets ?? "—"} />
        <KPI icon={CheckCircle2} label="موافقات قيد المراجعة" value={stats?.pendingApprovals ?? "—"} />
        <KPI icon={Network} label="مستهلكو API نشطون" value={stats?.apiConsumers ?? "—"} />
        <KPI
          icon={BarChart3} label="نسبة الاعتماد"
          value={stats?.totalProducts ? `${Math.round((stats.approvedProducts! / stats.totalProducts) * 100)}%` : "—"}
        />
      </div>

      {/* Status breakdown + price trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 surface-elevated border-0">
          <h3 className="font-bold mb-4">توزيع حالات البنود</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 surface-elevated border-0">
          <h3 className="font-bold mb-4">اتجاه تغير الأسعار (30 يوم)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="changes" stroke="hsl(var(--accent))" name="عدد التغييرات" />
                <Line type="monotone" dataKey="avg_delta" stroke="hsl(var(--primary))" name="متوسط الفرق" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 surface-elevated border-0">
          <h3 className="font-bold mb-4">أداء الموردين — أعلى 8 (عدد بنود)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierPerf}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="products" fill="hsl(var(--accent))" name="عدد البنود" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 surface-elevated border-0">
          <h3 className="font-bold mb-4">استخدام الـ API (14 يوم)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apiUsage}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="calls" stackId="a" fill="hsl(var(--accent))" name="نجاح" />
                <Bar dataKey="errors" stackId="a" fill="hsl(var(--destructive))" name="أخطاء" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
