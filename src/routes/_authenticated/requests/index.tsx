import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RequestForm } from "@/components/request-form";

export const Route = createFileRoute("/_authenticated/requests/")({
  head: () => ({ meta: [{ title: "طلبات المنتجات — Alazab PAOP" }] }),
  component: RequestsPage,
});

const PAGE = 50;

interface Filters {
  q: string;
  status: string;
  priority: string;
  type: string;
}

function RequestsPage() {
  const [filters, setFilters] = useState<Filters>({
    q: "",
    status: "all",
    priority: "all",
    type: "all",
  });
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["product-requests", filters, page],
    queryFn: async () => {
      let query = supabase
        .from("product_requests")
        .select("id, title, status, priority, request_type, created_at, quantity", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);

      if (filters.q) {
        query = query.ilike("title", `%${filters.q}%`);
      }
      if (filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.priority !== "all") {
        query = query.eq("priority", filters.priority);
      }
      if (filters.type !== "all") {
        query = query.eq("request_type", filters.type);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE);

  const statusMap: Record<string, { label: string; icon: any; tone: string }> = {
    open: { label: "مفتوح", icon: AlertCircle, tone: "bg-warning/15 text-warning" },
    in_review: { label: "قيد المراجعة", icon: Clock, tone: "bg-primary/15 text-primary" },
    approved: { label: "معتمد", icon: CheckCircle2, tone: "bg-success/15 text-success" },
    rejected: { label: "مرفوض", icon: AlertCircle, tone: "bg-destructive/15 text-destructive" },
  };

  const priorityMap: Record<string, string> = {
    low: "منخفضة",
    medium: "متوسطة",
    high: "عالية",
    urgent: "عاجلة",
  };

  const priorityColors: Record<string, string> = {
    low: "bg-secondary text-muted-foreground",
    medium: "bg-warning/15 text-warning",
    high: "bg-orange-500/15 text-orange-600",
    urgent: "bg-destructive/15 text-destructive",
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">طلبات المنتجات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة طلبات المنتجات والخدمات الجديدة من المستخدمين
          </p>
        </div>
        <Sheet open={showCreate} onOpenChange={setShowCreate}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              طلب جديد
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[540px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>إنشاء طلب جديد</SheetTitle>
              <SheetDescription>
                قم بإنشاء طلب منتج أو خدمة جديدة. سيتم مراجعة الطلب من قبل الفريق.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <RequestForm
                onSuccess={() => setShowCreate(false)}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card className="p-4 surface-elevated border-0">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن الطلبات..."
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
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="open">مفتوح</SelectItem>
              <SelectItem value="in_review">قيد المراجعة</SelectItem>
              <SelectItem value="approved">معتمد</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.priority}
            onValueChange={(v) => {
              setFilters({ ...filters, priority: v });
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="الأولوية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأولويات</SelectItem>
              <SelectItem value="low">منخفضة</SelectItem>
              <SelectItem value="medium">متوسطة</SelectItem>
              <SelectItem value="high">عالية</SelectItem>
              <SelectItem value="urgent">عاجلة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="surface-elevated border-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase">
              <tr>
                <th className="text-right p-3 font-semibold">العنوان</th>
                <th className="text-right p-3 font-semibold">النوع</th>
                <th className="text-right p-3 font-semibold">الأولوية</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
                <th className="text-right p-3 font-semibold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    جاري التحميل...
                  </td>
                </tr>
              )}
              {!isLoading && data?.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    لا توجد طلبات
                  </td>
                </tr>
              )}
              {data?.rows.map((req: any) => (
                <tr key={req.id} className="border-t hover:bg-secondary/30 cursor-pointer">
                  <td className="p-3">
                    <span className="text-accent font-medium">
                      {req.title}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {req.request_type === "new_product"
                      ? "منتج جديد"
                      : req.request_type === "new_service"
                        ? "خدمة جديدة"
                        : req.request_type === "bulk_order"
                          ? "طلب كمي"
                          : "طلب خاص"}
                  </td>
                  <td className="p-3">
                    <Badge className={`text-[10px] ${priorityColors[req.priority] || ""}`}>
                      {priorityMap[req.priority] || req.priority}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {statusMap[req.status] ? (
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${statusMap[req.status].tone}`}
                      >
                        {(() => {
                          const IconComponent = statusMap[req.status].icon;
                          return <IconComponent className="size-3" />;
                        })()}
                        {statusMap[req.status].label}
                      </div>
                    ) : (
                      <span className="text-xs">{req.status}</span>
                    )}
                  </td>
                  <td className="p-3 text-xs num">
                    {new Date(req.created_at).toLocaleDateString("ar")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3 border-t bg-secondary/30 text-xs">
          <div className="text-muted-foreground num" dir="ltr">
            Page {page + 1} / {pages || 1} - {total.toLocaleString("en-US")} requests
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
  );
}
