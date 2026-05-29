import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, DollarSign, TrendingUp, TrendingDown, History } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 }).format(n);

export function ProductPricingTab({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["product-prices", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prices")
        .select("*, suppliers(id, name)")
        .eq("product_id", productId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["price-history", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_history")
        .select("*, suppliers(name)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 surface-elevated border-0 flex items-center justify-between">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <DollarSign className="size-4 text-accent" /> الأسعار
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 num">{prices.length} سعر مسجّل</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 ml-1" /> سعر جديد
            </Button>
          </DialogTrigger>
          <PriceForm
            productId={productId}
            onDone={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["product-prices", productId] });
            }}
          />
        </Dialog>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground surface-elevated border-0">
          جاري التحميل...
        </Card>
      ) : prices.length === 0 ? (
        <Card className="p-12 text-center surface-elevated border-0">
          <DollarSign className="size-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            لا توجد أسعار. اضغط "سعر جديد" لإضافة أول سعر.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {prices.map((p: any) => {
            const margin =
              p.selling_price && p.purchase_price
                ? ((p.selling_price - p.purchase_price) / p.selling_price) * 100
                : null;
            return (
              <Card key={p.id} className="p-4 surface-elevated border-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {p.suppliers?.name ?? "سعر عام (بدون مورد)"}
                    </div>
                    <div className="text-2xl font-bold num mt-1" dir="ltr">
                      {fmt(p.selling_price)}{" "}
                      <span className="text-xs text-muted-foreground">{p.currency}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded ${p.status === "approved" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                  >
                    {p.status === "approved" ? "معتمد" : "قيد المراجعة"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t text-xs">
                  <div>
                    <div className="text-muted-foreground">شراء</div>
                    <div className="num font-semibold mt-0.5" dir="ltr">
                      {fmt(p.purchase_price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">الهامش</div>
                    <div
                      className={`num font-semibold mt-0.5 ${margin && margin > 0 ? "text-success" : "text-destructive"}`}
                      dir="ltr"
                    >
                      {margin == null ? "—" : `${margin.toFixed(1)}%`}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">المصدر</div>
                    <div className="font-semibold mt-0.5 text-[10px]">{p.source ?? "—"}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <Card className="surface-elevated border-0">
          <div className="p-4 border-b flex items-center gap-2">
            <History className="size-4 text-accent" />
            <h3 className="font-bold">سجل تغيرات السعر</h3>
            <span className="text-xs text-muted-foreground num">({history.length})</span>
          </div>
          <div className="divide-y">
            {history.map((h: any) => {
              const up = (h.new_price ?? 0) > (h.old_price ?? 0);
              return (
                <div key={h.id} className="p-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {up ? (
                      <TrendingUp className="size-4 text-destructive" />
                    ) : (
                      <TrendingDown className="size-4 text-success" />
                    )}
                    <div>
                      <div className="num text-xs" dir="ltr">
                        {fmt(h.old_price)} ← {fmt(h.new_price)} EGP
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {h.suppliers?.name ?? "—"} · {h.change_reason ?? h.source}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground num" dir="ltr">
                    {new Date(h.created_at).toLocaleString("en-EG")}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function PriceForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    supplier_id: "",
    selling_price: "",
    purchase_price: "",
    currency: "EGP",
    source: "manual",
    status: "approved",
  });

  const m = useMutation({
    mutationFn: async () => {
      const sell = parseFloat(form.selling_price);
      if (!sell || sell <= 0) throw new Error("سعر البيع مطلوب");
      const buy = form.purchase_price ? parseFloat(form.purchase_price) : null;
      const { error } = await supabase.from("prices").insert({
        product_id: productId,
        supplier_id: form.supplier_id || null,
        selling_price: sell,
        purchase_price: buy,
        currency: form.currency,
        source: form.source,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ السعر");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent dir="rtl">
      <DialogHeader>
        <DialogTitle>سعر جديد</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>المورد (اختياري)</Label>
          <Select
            value={form.supplier_id}
            onValueChange={(v) => setForm({ ...form, supplier_id: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="بدون مورد محدد" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>سعر الشراء</Label>
            <Input
              type="number"
              step="0.01"
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              dir="ltr"
            />
          </div>
          <div>
            <Label>سعر البيع *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              dir="ltr"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>العملة</Label>
            <Input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </div>
          <div>
            <Label>الحالة</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">معتمد</SelectItem>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
