import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets/duplicates")({
  head: () => ({ meta: [{ title: "أصول مكررة — Alazab PAOP" }] }),
  component: DuplicateAssets,
});

function DuplicateAssets() {
  const { data, isLoading } = useQuery({
    queryKey: ["assets-duplicates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, file_name, file_url, file_type, file_size, folder_path, created_at")
        .eq("status", "active")
        .order("file_name");
      if (error) throw error;
      // group by (file_name + file_size) → duplicates
      const groups = new Map<string, any[]>();
      (data ?? []).forEach((a) => {
        const k = `${a.file_name}::${a.file_size ?? 0}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(a);
      });
      return Array.from(groups.entries())
        .filter(([_, v]) => v.length > 1)
        .map(([k, v]) => ({ key: k, items: v }));
    },
  });

  return (
    <div className="p-6 space-y-5 max-w-[1500px] mx-auto">
      <Link
        to="/assets"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowRight className="size-3" /> العودة لإدارة الأصول
      </Link>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Copy className="size-6 text-warning" /> أصول مكررة
        </h1>
        <p className="text-sm text-muted-foreground mt-1">مجموعات الملفات بنفس الاسم والحجم</p>
      </div>

      <Card className="p-5 surface-elevated border-0 space-y-5">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : !data?.length ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            لا توجد ملفات مكررة ✓
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground num" dir="ltr">
              {data.length} duplicate groups
            </div>
            {data.map((g) => (
              <div key={g.key} className="space-y-2 border-b pb-4 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold truncate">{g.items[0].file_name}</div>
                  <div className="text-xs num text-muted-foreground" dir="ltr">
                    ×{g.items.length}
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {g.items.map((a: any) => (
                    <div
                      key={a.id}
                      className="aspect-square rounded overflow-hidden bg-muted border"
                    >
                      {a.file_type?.startsWith("image/") ? (
                        <img
                          src={a.file_url}
                          alt={a.file_name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="size-full grid place-items-center text-[10px] text-muted-foreground p-2 text-center">
                          {a.file_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}
