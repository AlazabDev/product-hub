import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Languages, ArrowLeftRight, Check } from "lucide-react";
import { translateProduct, applyTranslations } from "@/lib/translation.functions";
import { toast } from "sonner";

const LABELS: Record<string, string> = {
  name_ar: "الاسم (عربي)", name_en: "Name (EN)",
  short_description_ar: "وصف مختصر (عربي)", short_description_en: "Short description (EN)",
  description_ar: "الوصف (عربي)", description_en: "Description (EN)",
  marketing_content: "المحتوى التسويقي", technical_content: "المحتوى الفني",
  warranty_info: "معلومات الضمان",
};

export function ProductTranslationTab({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [direction, setDirection] = useState<"ar_to_en" | "en_to_ar">("ar_to_en");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: product } = useQuery({
    queryKey: ["product", productId, "translation"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", productId).single();
      if (error) throw error;
      return data;
    },
  });

  const translateFn = useServerFn(translateProduct);
  const applyFn = useServerFn(applyTranslations);

  const translate = useMutation({
    mutationFn: () => translateFn({ data: { productId, direction } }),
    onSuccess: (res) => {
      setDrafts(res.translations as Record<string, string>);
      setSelected(new Set(Object.keys(res.translations)));
      toast.success(`تم اقتراح ${Object.keys(res.translations).length} ترجمة`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: () => {
      const filtered: Record<string, string> = {};
      for (const k of selected) if (drafts[k]) filtered[k] = drafts[k];
      return applyFn({ data: { productId, translations: filtered } });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["product", productId] });
      toast.success(`تم تطبيق ${res.applied} حقل`);
      setDrafts({}); setSelected(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!product) return null;

  return (
    <div className="space-y-4">
      <Card className="p-5 surface-elevated border-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Languages className="size-5 text-accent" />
            <h3 className="font-bold">الترجمة الذكية</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant={direction === "ar_to_en" ? "default" : "outline"}
              onClick={() => setDirection("ar_to_en")}
            >عربي ← English</Button>
            <ArrowLeftRight className="size-3.5 text-muted-foreground" />
            <Button
              size="sm" variant={direction === "en_to_ar" ? "default" : "outline"}
              onClick={() => setDirection("en_to_ar")}
            >English ← عربي</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          استخدام Lovable AI (Gemini) لاقتراح ترجمة احترافية. راجع وعدّل قبل التطبيق.
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Button onClick={() => translate.mutate()} disabled={translate.isPending} className="gap-1.5">
            {translate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
            اقتراح ترجمة
          </Button>
          {Object.keys(drafts).length > 0 && (
            <Button onClick={() => apply.mutate()} disabled={apply.isPending || selected.size === 0} variant="default" className="gap-1.5">
              <Check className="size-4" /> تطبيق ({selected.size})
            </Button>
          )}
        </div>
      </Card>

      {Object.keys(drafts).length === 0 ? (
        <Card className="p-12 surface-elevated border-0 text-center">
          <Languages className="size-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">اضغط "اقتراح ترجمة" لتوليد ترجمة بالـ AI.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Object.entries(drafts).map(([field, value]) => {
            const original = (product as Record<string, string | null>)[field];
            return (
              <Card key={field} className="p-4 surface-elevated border-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selected.has(field)}
                      onCheckedChange={(c) => {
                        const n = new Set(selected);
                        if (c) n.add(field); else n.delete(field);
                        setSelected(n);
                      }}
                    />
                    <span className="text-sm font-semibold">{LABELS[field] ?? field}</span>
                  </div>
                  {original && <span className="text-[10px] bg-warning/15 text-warning rounded px-1.5 py-0.5">سيستبدل القيمة الحالية</span>}
                </div>
                {original && (
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2 max-h-20 overflow-auto">
                    <span className="font-semibold">الحالي:</span> {original}
                  </div>
                )}
                <Textarea
                  value={value}
                  onChange={(e) => setDrafts((d) => ({ ...d, [field]: e.target.value }))}
                  rows={field.includes("description") || field.includes("content") ? 4 : 2}
                  dir={field.endsWith("_en") ? "ltr" : "rtl"}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
