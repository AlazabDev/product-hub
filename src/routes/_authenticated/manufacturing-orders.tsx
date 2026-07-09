/**
 * Alazab PAOP - Manufacturing Orders Management
 * صفحة ادارة اوامر التصنيع
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateManufacturingOrderStatus } from "@/lib/manufacturing.functions";
import { toast } from "sonner";
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
  Factory,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Search,
  Filter,
  Eye,
  PlayCircle,
  PauseCircle,
  ChevronDown,
  FileText,
  Boxes,
  Calendar,
  DollarSign,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/manufacturing-orders")({
  component: ManufacturingOrdersPage,
});

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "قيد الانتظار", color: "bg-amber-100 text-amber-800", icon: Clock },
  materials_requested: { label: "طلب الخامات", color: "bg-blue-100 text-blue-800", icon: Boxes },
  in_production: { label: "قيد التصنيع", color: "bg-purple-100 text-purple-800", icon: Factory },
  quality_check: { label: "فحص الجودة", color: "bg-cyan-100 text-cyan-800", icon: CheckCircle2 },
  ready: { label: "جاهز للتسليم", color: "bg-emerald-100 text-emerald-800", icon: Package },
  delivered: { label: "تم التسليم", color: "bg-green-100 text-green-800", icon: Truck },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-800", icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "منخفضة", color: "bg-gray-100 text-gray-600" },
  normal: { label: "عادية", color: "bg-blue-100 text-blue-600" },
  high: { label: "عالية", color: "bg-orange-100 text-orange-600" },
  urgent: { label: "عاجلة", color: "bg-red-100 text-red-600" },
};

async function fetchOrders(filters: { status?: string; search?: string }) {
  let query = supabase
    .from("manufacturing_orders")
    .select(
      `
      *,
      quote_requests(request_id, design_preview_url, customer_name),
      material_requisitions(id, requisition_number, status)
    `,
    )
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.search) {
    const s = sanitizeFilterInput(filters.search);
    if (s) query = query.or(`order_number.ilike.%${s}%,customer_name.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchOrderStats() {
  const { data } = await supabase.from("manufacturing_orders").select("status");
  const stats: Record<string, number> = {
    total: 0,
    pending: 0,
    in_production: 0,
    ready: 0,
  };
  (data || []).forEach((o: any) => {
    stats.total++;
    if (o.status === "pending" || o.status === "materials_requested") stats.pending++;
    else if (o.status === "in_production" || o.status === "quality_check") stats.in_production++;
    else if (o.status === "ready") stats.ready++;
  });
  return stats;
}

function ManufacturingOrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["manufacturing-orders", statusFilter, search],
    queryFn: () => fetchOrders({ status: statusFilter, search }),
  });

  const { data: stats } = useQuery({
    queryKey: ["manufacturing-stats"],
    queryFn: fetchOrderStats,
  });

  const updateStatusFn = useServerFn(updateManufacturingOrderStatus);
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateStatusFn({
        data: {
          orderId: id,
          status: status as
            | "pending"
            | "materials_requested"
            | "in_production"
            | "quality_check"
            | "ready"
            | "delivered"
            | "cancelled",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing-orders"] });
      queryClient.invalidateQueries({ queryKey: ["manufacturing-stats"] });
      toast.success("تم تحديث حالة الأمر");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statCards = [
    { label: "اجمالي الاوامر", value: stats?.total || 0, icon: FileText, color: "text-primary" },
    { label: "في الانتظار", value: stats?.pending || 0, icon: Clock, color: "text-amber-600" },
    {
      label: "قيد التصنيع",
      value: stats?.in_production || 0,
      icon: Factory,
      color: "text-purple-600",
    },
    { label: "جاهز للتسليم", value: stats?.ready || 0, icon: Package, color: "text-emerald-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">اوامر التصنيع</h1>
          <p className="text-muted-foreground">ادارة ومتابعة اوامر التصنيع من الشات بوت</p>
        </div>
        <Link to="/quote-requests">
          <Button variant="outline">طلبات العروض</Button>
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
              placeholder="بحث برقم الامر او اسم العميل..."
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
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="surface-elevated border-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right p-4 font-medium">رقم الامر</th>
                <th className="text-right p-4 font-medium">العميل</th>
                <th className="text-right p-4 font-medium">الحالة</th>
                <th className="text-right p-4 font-medium">الاولوية</th>
                <th className="text-right p-4 font-medium">السعر</th>
                <th className="text-right p-4 font-medium">التاريخ المتوقع</th>
                <th className="text-right p-4 font-medium">اجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    جاري التحميل...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    لا توجد اوامر تصنيع
                  </td>
                </tr>
              ) : (
                orders.map((order: any) => {
                  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  const priority = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.normal;
                  const StatusIcon = status.icon;

                  return (
                    <tr key={order.id} className="hover:bg-muted/30">
                      <td className="p-4">
                        <div className="font-mono font-medium">{order.order_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.quote_requests?.request_id}
                        </div>
                      </td>
                      <td className="p-4">
                        <div>{order.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
                      </td>
                      <td className="p-4">
                        <Badge className={`${status.color} gap-1`}>
                          <StatusIcon className="size-3" />
                          {status.label}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge className={priority.color}>{priority.label}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="font-medium">
                          {order.final_price?.toLocaleString()} {order.currency}
                        </div>
                        <div className="text-xs text-muted-foreground">{order.quantity} وحدة</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="size-3" />
                          {order.estimated_completion_date}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedOrder(order)}
                              >
                                <Eye className="size-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>تفاصيل الامر {order.order_number}</DialogTitle>
                              </DialogHeader>
                              <OrderDetails order={order} />
                            </DialogContent>
                          </Dialog>

                          {/* Status Actions */}
                          {order.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: order.id,
                                  status: "materials_requested",
                                })
                              }
                            >
                              <Boxes className="size-4 ml-1" />
                              طلب خامات
                            </Button>
                          )}
                          {order.status === "materials_requested" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: order.id,
                                  status: "in_production",
                                })
                              }
                            >
                              <PlayCircle className="size-4 ml-1" />
                              بدء التصنيع
                            </Button>
                          )}
                          {order.status === "in_production" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: order.id,
                                  status: "quality_check",
                                })
                              }
                            >
                              <CheckCircle2 className="size-4 ml-1" />
                              فحص الجودة
                            </Button>
                          )}
                          {order.status === "quality_check" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: order.id,
                                  status: "ready",
                                })
                              }
                            >
                              <Package className="size-4 ml-1" />
                              جاهز
                            </Button>
                          )}
                          {order.status === "ready" && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: order.id,
                                  status: "delivered",
                                })
                              }
                            >
                              <Truck className="size-4 ml-1" />
                              تسليم
                            </Button>
                          )}
                        </div>
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

function OrderDetails({ order }: { order: any }) {
  const specs = order.specifications || {};

  return (
    <div className="space-y-6">
      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted-foreground">العميل</label>
          <p className="font-medium">{order.customer_name}</p>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">الهاتف</label>
          <p className="font-medium">{order.customer_phone}</p>
        </div>
        <div className="col-span-2">
          <label className="text-sm text-muted-foreground">عنوان التسليم</label>
          <p className="font-medium">{order.delivery_address || "لم يحدد"}</p>
        </div>
      </div>

      {/* Dimensions */}
      {specs.dimensions && (
        <div>
          <h4 className="font-medium mb-2">الابعاد</h4>
          <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-lg font-bold">{specs.dimensions.width}</p>
              <p className="text-xs text-muted-foreground">العرض (سم)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{specs.dimensions.height}</p>
              <p className="text-xs text-muted-foreground">الارتفاع (سم)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{specs.dimensions.depth}</p>
              <p className="text-xs text-muted-foreground">العمق (سم)</p>
            </div>
          </div>
        </div>
      )}

      {/* Materials */}
      {specs.materials && specs.materials.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">الخامات</h4>
          <div className="space-y-2">
            {specs.materials.map((mat: any, i: number) => (
              <div key={i} className="flex justify-between p-2 bg-muted/30 rounded">
                <span>{mat.material_name}</span>
                <span className="text-muted-foreground">
                  {mat.quantity} {mat.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      <div>
        <h4 className="font-medium mb-2">التسعير</h4>
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <div className="flex justify-between">
            <span>سعر الوحدة</span>
            <span>
              {order.unit_price?.toLocaleString()} {order.currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span>الكمية</span>
            <span>{order.quantity}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>الخصم</span>
              <span>
                -{order.discount_amount?.toLocaleString()} {order.currency}
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>الاجمالي</span>
            <span>
              {order.final_price?.toLocaleString()} {order.currency}
            </span>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted-foreground">تاريخ البدء المتوقع</label>
          <p className="font-medium">{order.estimated_start_date}</p>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">تاريخ الانتهاء المتوقع</label>
          <p className="font-medium">{order.estimated_completion_date}</p>
        </div>
        {order.actual_start_date && (
          <div>
            <label className="text-sm text-muted-foreground">تاريخ البدء الفعلي</label>
            <p className="font-medium">{order.actual_start_date}</p>
          </div>
        )}
        {order.actual_completion_date && (
          <div>
            <label className="text-sm text-muted-foreground">تاريخ الانتهاء الفعلي</label>
            <p className="font-medium">{order.actual_completion_date}</p>
          </div>
        )}
      </div>

      {/* Material Requisition */}
      {order.material_requisitions?.[0] && (
        <div className="p-3 border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">امر صرف الخامات</p>
              <p className="text-sm text-muted-foreground font-mono">
                {order.material_requisitions[0].requisition_number}
              </p>
            </div>
            <Badge>{order.material_requisitions[0].status}</Badge>
          </div>
        </div>
      )}
    </div>
  );
}
