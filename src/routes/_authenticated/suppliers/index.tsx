import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Mail, Phone, Truck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SupplierForm } from "@/components/supplier-form";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers/")({
  head: () => ({ meta: [{ title: "الموردون — Alazab PAOP" }] }),
  component: SuppliersList,
});

const TIER_LABEL: Record<string, string> = {
  first_tier: "درجة أولى",
  second_tier: "درجة ثانية",
  backup: "احتياطي",
};

function SuppliersList() {
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["suppliers", q],
    queryFn: async () => {
      let query = supabase
        .from("suppliers")
        .select("id, name_ar, name_en, supplier_code, category, tier, email, phone, status")
        .order("created_at", { ascending: false });
      if (q) {
        query = query.or(`name_ar.ilike.%${q}%,name_en.ilike.%${q}%,supplier_code.ilike.%${q}%`);
      }
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data;
    },
  });

  const tierMap: Record<string, { label: string; color: string }> = {
    first_tier: { label: "الدرجة الأولى", color: "bg-success/15 text-success" },
    second_tier: { label: "الدرجة الثانية", color: "bg-primary/15 text-primary" },
    backup: { label: "احتياطي", color: "bg-warning/15 text-warning" },
    local: { label: "محلي", color: "bg-accent/15 text-accent" },
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="size-6 text-accent" />
            الموردون
          </h1>
          <p className="text-xs text-muted-foreground mt-1 num">إجمالي: {rows.length} مورد</p>
        </div>
        <Sheet open={showCreate} onOpenChange={setShowCreate}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              مورد جديد
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[540px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>إضافة مورد جديد</SheetTitle>
              <SheetDescription>
                أضف معلومات المورد الجديد بما في ذلك بيانات التواصل والفئة
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <SupplierForm
                onSuccess={() => {
                  setShowCreate(false);
                  qc.invalidateQueries({ queryKey: ["suppliers"] });
                }}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card className="p-3 surface-elevated border-0">
        <div className="relative">
          <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم، الرمز..."
            className="pr-9"
          />
        </div>
      </Card>

      <Card className="surface-elevated border-0 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">لا يوجد موردون</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-right p-3 font-semibold">الاسم</th>
                  <th className="text-right p-3 font-semibold">الرمز</th>
                  <th className="text-right p-3 font-semibold">الفئة</th>
                  <th className="text-right p-3 font-semibold">المستوى</th>
                  <th className="text-center p-3 font-semibold">التواصل</th>
                  <th className="text-right p-3 font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: any) => (
                  <tr key={s.id} className="border-t hover:bg-secondary/30">
                    <td className="p-3">
                      <Link
                        to={`/suppliers/${s.id}`}
                        className="text-accent hover:underline font-medium"
                      >
                        {s.name_ar}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.name_en}</div>
                    </td>
                    <td className="p-3 text-xs num" dir="ltr">
                      {s.supplier_code || "—"}
                    </td>
                    <td className="p-3 text-xs">{s.category || "—"}</td>
                    <td className="p-3">
                      <Badge className={`text-[10px] ${tierMap[s.tier]?.color || ""}`}>
                        {tierMap[s.tier]?.label || s.tier}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {s.email && (
                          <a
                            href={`mailto:${s.email}`}
                            className="p-1 rounded hover:bg-secondary"
                            title="بريد إلكتروني"
                          >
                            <Mail className="size-4 text-muted-foreground hover:text-foreground" />
                          </a>
                        )}
                        {s.phone && (
                          <a
                            href={`tel:${s.phone}`}
                            className="p-1 rounded hover:bg-secondary"
                            title="هاتف"
                          >
                            <Phone className="size-4 text-muted-foreground hover:text-foreground" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={
                          s.status === "active"
                            ? "bg-success/15 text-success border-success/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {s.status === "active" ? "نشط" : "غير نشط"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
