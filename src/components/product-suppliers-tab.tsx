import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Truck, Mail, Phone } from "lucide-react";

const fmt = (n: number | null) => n == null ? "—" : new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 }).format(n);

export function ProductSuppliersTab({ productId }: { productId: string }) {
  // Suppliers linked through prices + supplier_inventory
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["product-suppliers", productId],
    queryFn: async () => {
      const [{ data: pricesRows }, { data: invRows }] = await Promise.all([
        supabase.from("prices").select("supplier_id, selling_price, purchase_price, currency, suppliers(id, name, contact_name, email, phone, supplier_tier)").eq("product_id", productId).not("supplier_id", "is", null),
        supabase.from("supplier_inventory").select("*, suppliers(id, name, contact_name, email, phone, supplier_tier)").eq("internal_product_id", productId),
      ]);
      const map = new Map<string, any>();
      (pricesRows ?? []).forEach((p: any) => {
        if (!p.suppliers) return;
        const k = p.suppliers.id;
        const ex = map.get(k) ?? { supplier: p.suppliers, price: null, inv: null };
        ex.price = { selling: p.selling_price, purchase: p.purchase_price, currency: p.currency };
        map.set(k, ex);
      });
      (invRows ?? []).forEach((i: any) => {
        if (!i.suppliers) return;
        const k = i.suppliers.id;
        const ex = map.get(k) ?? { supplier: i.suppliers, price: null, inv: null };
        ex.inv = i;
        map.set(k, ex);
      });
      return Array.from(map.values());
    },
  });

  if (isLoading) return <Card className="p-8 text-center text-muted-foreground surface-elevated border-0">جاري التحميل...</Card>;

  if (rows.length === 0) {
    return (
      <Card className="p-12 text-center surface-elevated border-0">
        <Truck className="size-10 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">لا يوجد موردون مرتبطون بهذا المنتج.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">أضف سعر مرتبط بمورد في تاب التسعير ليظهر هنا.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((r: any) => (
        <Card key={r.supplier.id} className="p-4 surface-elevated border-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold">{r.supplier.name}</h3>
              {r.supplier.contact_name && <p className="text-xs text-muted-foreground mt-0.5">{r.supplier.contact_name}</p>}
            </div>
            <span className="text-[10px] bg-accent/15 text-accent rounded px-2 py-0.5">
              {r.supplier.supplier_tier === "first_tier" ? "درجة أولى" : r.supplier.supplier_tier === "backup" ? "احتياطي" : "درجة ثانية"}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-xs">
            {r.supplier.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="size-3" />{r.supplier.email}</div>}
            {r.supplier.phone && <div className="flex items-center gap-1.5 text-muted-foreground num" dir="ltr"><Phone className="size-3" />{r.supplier.phone}</div>}
          </div>
          {r.price && (
            <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-muted-foreground">سعر البيع</div><div className="num font-semibold" dir="ltr">{fmt(r.price.selling)} {r.price.currency}</div></div>
              <div><div className="text-muted-foreground">سعر الشراء</div><div className="num font-semibold" dir="ltr">{fmt(r.price.purchase)} {r.price.currency}</div></div>
            </div>
          )}
          {r.inv && (
            <div className="mt-2 pt-2 border-t text-xs">
              <div className="text-muted-foreground">المخزون لدى المورد</div>
              <div className="num font-semibold mt-0.5" dir="ltr">{r.inv.available_quantity ?? "—"} · {r.inv.availability_status ?? "غير محدد"}</div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
