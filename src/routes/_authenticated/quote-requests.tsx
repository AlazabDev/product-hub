/**
 * Alazab PAOP - Quote Requests Management
 * صفحة ادارة طلبات العروض من الشات بوت
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, Filter, Eye, DollarSign, Calendar, User,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/quote-requests")({
  component: QuoteRequestsPage,
});

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "قيد المعالجة", color: "bg-amber-100 text-amber-800", icon: Clock },
  quoted: { label: "تم التسعير", color: "bg-blue-100 text-blue-800", icon: DollarSign },
  accepted: { label: "مقبول", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800", icon: XCircle },
  expired: { label: "منتهي", color: "bg-gray-100 text-gray-600", icon: AlertCircle },
};

async function fetchQuoteRequests(filters: { status?: string; search?: string }) {
  let query = supabase
    .from("quote_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.search) {
    query = query.or(`request_id.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchQuoteStats() {
  const { data } = await supabase.from("quote_requests").select("status");
  const stats: Record<string, number> = {
    total: 0,
    quoted: 0,
    accepted: 0,
    rejected: 0,
  };
  (data || []).forEach((q: any) => {
    stats.total++;
    if (q.status === "quoted") stats.quoted++;
    else if (q.status === "accepted") stats.accepted++;
    else if (q.status === "rejected") stats.rejected++;
  });
  return stats;
}

function QuoteRequestsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quote-requests", statusFilter, search],
    queryFn: () => fetchQuoteRequests({ status: statusFilter, search }),
  });

  const { data: stats } = useQuery({
    queryKey: ["quote-stats"],
    queryFn: fetchQuoteStats,
  });

  const statCards = [
    { label: "اجمالي الطلبات", value: stats?.total || 0, icon: FileText, color: "text-primary" },
    { label: "تم التسعير", value: stats?.quoted || 0, icon: DollarSign, color: "text-blue-600" },
    { label: "مقبولة", value: stats?.accepted || 0, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "مرفوضة", value: stats?.rejected || 0, icon: XCircle, color: "text-red-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">طلبات العروض</h1>
          <p className="text-muted-foreground">طلبات التسعير الواردة من الشات بوت</p>
        </div>
        <Link to="/manufacturing-orders">
          <Button>اوامر التصنيع</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4 surface-elevated border-0">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                <stat.icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4 surface-elevated border-0">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم الطلب او اسم العميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="size-4 ml-2" />
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Quotes Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-muted-foreground">
            جاري التحميل...
          </div>
        ) : quotes.length === 0 ? (
          <div className="col-span-full p-8 text-center text-muted-foreground">
            لا توجد طلبات عروض
          </div>
        ) : (
          quotes.map((quote: any) => {
            const status = STATUS_CONFIG[quote.status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            const dimensions = quote.dimensions as any;

            return (
              <Card key={quote.id} className="surface-elevated border-0 overflow-hidden">
                {/* Preview Image */}
                {quote.design_preview_url && (
                  <div className="h-40 bg-muted">
                    <img
                      src={quote.design_preview_url}
                      alt="Design Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-sm text-muted-foreground">{quote.request_id}</p>
                      <p className="font-medium">{quote.customer_name || "عميل"}</p>
                    </div>
                    <Badge className={`${status.color} gap-1`}>
                      <StatusIcon className="size-3" />
                      {status.label}
                    </Badge>
                  </div>

                  {/* Dimensions */}
                  {dimensions && (
                    <div className="flex gap-4 text-sm">
                      <span>العرض: {dimensions.width} سم</span>
                      <span>الارتفاع: {dimensions.height} سم</span>
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">السعر</span>
                    <span className="text-lg font-bold">
                      {quote.selling_price?.toLocaleString() || "-"} {quote.currency}
                    </span>
                  </div>

                  {/* Validity */}
                  {quote.quote_valid_until && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      صالح حتى: {new Date(quote.quote_valid_until).toLocaleDateString("ar")}
                    </div>
                  )}

                  {/* Actions */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Eye className="size-4 ml-2" />
                        عرض التفاصيل
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>تفاصيل طلب العرض {quote.request_id}</DialogTitle>
                      </DialogHeader>
                      <QuoteDetails quote={quote} />
                    </DialogContent>
                  </Dialog>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function QuoteDetails({ quote }: { quote: any }) {
  const dimensions = quote.dimensions as any;
  const materials = quote.materials as any[] || [];
  const pricing = quote.pricing_breakdown as any || {};
  const finishes = quote.finishes as any || {};

  return (
    <div className="space-y-6">
      {/* Preview */}
      {quote.design_preview_url && (
        <div className="rounded-lg overflow-hidden bg-muted">
          <img
            src={quote.design_preview_url}
            alt="Design Preview"
            className="w-full max-h-64 object-contain"
          />
        </div>
      )}

      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted-foreground">العميل</label>
          <p className="font-medium">{quote.customer_name || "-"}</p>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">الهاتف</label>
          <p className="font-medium">{quote.customer_phone || "-"}</p>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">البريد</label>
          <p className="font-medium">{quote.customer_email || "-"}</p>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">معرف الجلسة</label>
          <p className="font-mono text-sm">{quote.chatbot_session_id || "-"}</p>
        </div>
      </div>

      {/* Dimensions */}
      {dimensions && (
        <div>
          <h4 className="font-medium mb-2">الابعاد</h4>
          <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-xl font-bold">{dimensions.width}</p>
              <p className="text-xs text-muted-foreground">العرض (سم)</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{dimensions.height}</p>
              <p className="text-xs text-muted-foreground">الارتفاع (سم)</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{dimensions.depth}</p>
              <p className="text-xs text-muted-foreground">العمق (سم)</p>
            </div>
          </div>
        </div>
      )}

      {/* Materials */}
      {materials.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">الخامات</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-2 text-sm">الخامة</th>
                  <th className="text-right p-2 text-sm">الكمية</th>
                  <th className="text-right p-2 text-sm">سعر الوحدة</th>
                  <th className="text-right p-2 text-sm">الاجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {materials.map((mat: any, i: number) => (
                  <tr key={i}>
                    <td className="p-2">{mat.material_name}</td>
                    <td className="p-2">{mat.quantity} {mat.unit}</td>
                    <td className="p-2">{mat.unit_cost?.toLocaleString()}</td>
                    <td className="p-2 font-medium">{mat.total_cost?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Finishes */}
      {Object.keys(finishes).length > 0 && (
        <div>
          <h4 className="font-medium mb-2">التشطيبات</h4>
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
            {finishes.color && (
              <div>
                <p className="text-sm text-muted-foreground">اللون</p>
                <p className="font-medium">{finishes.color}</p>
              </div>
            )}
            {finishes.coating && (
              <div>
                <p className="text-sm text-muted-foreground">الدهان</p>
                <p className="font-medium">{finishes.coating}</p>
              </div>
            )}
            {finishes.texture && (
              <div>
                <p className="text-sm text-muted-foreground">الملمس</p>
                <p className="font-medium">{finishes.texture}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Breakdown */}
      <div>
        <h4 className="font-medium mb-2">تفاصيل التسعير</h4>
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between">
            <span>تكلفة الخامات</span>
            <span>{quote.materials_cost?.toLocaleString()} {quote.currency}</span>
          </div>
          <div className="flex justify-between">
            <span>تكلفة العمالة</span>
            <span>{quote.labor_cost?.toLocaleString()} {quote.currency}</span>
          </div>
          <div className="flex justify-between">
            <span>تكاليف غير مباشرة</span>
            <span>{quote.overhead_cost?.toLocaleString()} {quote.currency}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span>التكلفة الاجمالية</span>
            <span>{quote.total_cost?.toLocaleString()} {quote.currency}</span>
          </div>
          <div className="flex justify-between text-emerald-600">
            <span>هامش الربح ({quote.profit_margin}%)</span>
            <span>+{((quote.selling_price || 0) - (quote.total_cost || 0)).toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>سعر البيع</span>
            <span>{quote.selling_price?.toLocaleString()} {quote.currency}</span>
          </div>
        </div>
      </div>

      {/* Customer Response */}
      {quote.customer_response && (
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-2">رد العميل</h4>
          <Badge className={quote.customer_response === "accepted" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
            {quote.customer_response === "accepted" ? "مقبول" : "مرفوض"}
          </Badge>
          {quote.rejection_reason && (
            <p className="mt-2 text-sm text-muted-foreground">{quote.rejection_reason}</p>
          )}
        </div>
      )}

      {/* Notes */}
      {(quote.customer_notes || quote.special_requirements) && (
        <div>
          <h4 className="font-medium mb-2">ملاحظات</h4>
          {quote.customer_notes && (
            <p className="text-sm mb-2">{quote.customer_notes}</p>
          )}
          {quote.special_requirements && (
            <p className="text-sm text-muted-foreground">{quote.special_requirements}</p>
          )}
        </div>
      )}
    </div>
  );
}
