import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFilterInput } from "@/lib/sanitize-filter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  History,
  FileText,
  Package,
  Truck,
  DollarSign,
  Image,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  head: () => ({ meta: [{ title: "سجل التدقيق — Alazab PAOP" }] }),
  component: AuditLogsPage,
});

const PAGE = 30;

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  create: { label: "انشاء", color: "bg-success/15 text-success" },
  update: { label: "تحديث", color: "bg-accent/15 text-accent" },
  delete: { label: "حذف", color: "bg-destructive/15 text-destructive" },
  approve: { label: "اعتماد", color: "bg-success/15 text-success" },
  reject: { label: "رفض", color: "bg-destructive/15 text-destructive" },
  archive: { label: "ارشفة", color: "bg-muted text-muted-foreground" },
  restore: { label: "استعادة", color: "bg-accent/15 text-accent" },
};

const entityLabels: Record<string, { label: string; icon: typeof Package }> = {
  product: { label: "منتج", icon: Package },
  supplier: { label: "مورد", icon: Truck },
  price: { label: "سعر", icon: DollarSign },
  asset: { label: "اصل", icon: Image },
  user: { label: "مستخدم", icon: User },
  category: { label: "فئة", icon: FileText },
};

function AuditLogsPage() {
  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", q, entityType, actionFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);

      if (q) {
        query = query.or(`entity_id.ilike.%${q}%,created_by.ilike.%${q}%`);
      }
      if (entityType !== "all") {
        query = query.eq("entity_type", entityType);
      }
      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as AuditLog[], count: count ?? 0 };
    },
  });

  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE);

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="size-6" />
            سجل التدقيق
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="num">{total.toLocaleString("en-US")}</span> سجل مراجعة
          </p>
        </div>
      </div>

      <Card className="p-4 surface-elevated border-0">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="بحث بمعرف الكيان..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              className="pr-9"
            />
          </div>
          <Select
            value={entityType}
            onValueChange={(v) => {
              setEntityType(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="نوع الكيان" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الانواع</SelectItem>
              <SelectItem value="product">منتج</SelectItem>
              <SelectItem value="supplier">مورد</SelectItem>
              <SelectItem value="price">سعر</SelectItem>
              <SelectItem value="asset">اصل</SelectItem>
              <SelectItem value="category">فئة</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="الاجراء" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الاجراءات</SelectItem>
              <SelectItem value="create">انشاء</SelectItem>
              <SelectItem value="update">تحديث</SelectItem>
              <SelectItem value="delete">حذف</SelectItem>
              <SelectItem value="approve">اعتماد</SelectItem>
              <SelectItem value="reject">رفض</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="surface-elevated border-0 overflow-hidden">
        <div className="divide-y">
          {isLoading && (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          )}
          {!isLoading && data?.rows.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">لا توجد سجلات</div>
          )}
          {data?.rows.map((log) => {
            const action = actionLabels[log.action] ?? { label: log.action, color: "bg-secondary" };
            const entity = entityLabels[log.entity_type] ?? {
              label: log.entity_type,
              icon: FileText,
            };
            const EntityIcon = entity.icon;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} className="hover:bg-secondary/30">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full p-4 flex items-center gap-4 text-right"
                >
                  <div className="size-10 rounded-lg bg-secondary grid place-items-center shrink-0">
                    <EntityIcon className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={action.color}>
                        {action.label}
                      </Badge>
                      <span className="text-sm font-medium">{entity.label}</span>
                      {log.entity_id && (
                        <span className="text-xs num text-muted-foreground" dir="ltr">
                          #{log.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.created_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
                      {log.created_by && (
                        <span className="mr-2 num" dir="ltr">
                          بواسطة: {log.created_by.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>
                  {(log.old_value || log.new_value) &&
                    (isExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ))}
                </button>

                {isExpanded && (log.old_value || log.new_value) && (
                  <div className="px-4 pb-4 grid md:grid-cols-2 gap-4">
                    {log.old_value && (
                      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        <div className="text-xs font-semibold text-destructive mb-2">
                          القيمة السابقة
                        </div>
                        <pre className="text-xs num overflow-auto max-h-40" dir="ltr">
                          {JSON.stringify(log.old_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_value && (
                      <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                        <div className="text-xs font-semibold text-success mb-2">
                          القيمة الجديدة
                        </div>
                        <pre className="text-xs num overflow-auto max-h-40" dir="ltr">
                          {JSON.stringify(log.new_value, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
  );
}
