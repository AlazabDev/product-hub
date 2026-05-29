import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2Off, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { softDeleteAsset } from "@/lib/upload-assets";

export const Route = createFileRoute("/_authenticated/assets/unlinked")({
  head: () => ({ meta: [{ title: "أصول غير مرتبطة — Alazab PAOP" }] }),
  component: UnlinkedAssets,
});

function UnlinkedAssets() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["assets-unlinked"],
    queryFn: async () => {
      // Get assets with no product_assets row + active status
      const { data: linked } = await supabase.from("product_assets").select("asset_id");
      const linkedIds = new Set((linked ?? []).map((r) => r.asset_id));
      const { data: all, error } = await supabase
        .from("assets")
        .select("id, file_name, file_url, file_type, file_size, folder_path, created_at, status")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (all ?? []).filter((a) => !linkedIds.has(a.id));
    },
  });

  const onArchive = async (id: string) => {
    try {
      await softDeleteAsset(id);
      qc.invalidateQueries({ queryKey: ["assets-unlinked"] });
      toast.success("تم أرشفة الأصل (soft delete)");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

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
          <Link2Off className="size-6 text-warning" /> أصول غير مرتبطة
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          صور وملفات تم رفعها ولم يتم ربطها بأي منتج بعد
        </p>
      </div>

      <Card className="p-5 surface-elevated border-0">
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {Array.from({ length: 16 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        ) : !data?.length ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            لا توجد أصول غير مرتبطة. كل ملف مرتبط بمنتج ✓
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-3 num" dir="ltr">
              {data.length} unlinked
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {data.map((a) => (
                <Card key={a.id} className="surface-elevated border-0 overflow-hidden group">
                  <div className="aspect-square bg-muted">
                    {a.file_type?.startsWith("image/") ? (
                      <img
                        src={a.file_url}
                        alt={a.file_name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full grid place-items-center text-xs text-muted-foreground p-2 text-center">
                        {a.file_name}
                      </div>
                    )}
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="text-[11px] truncate" title={a.file_name}>
                      {a.file_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground num" dir="ltr">
                      {a.folder_path}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onArchive(a.id)}
                      className="h-7 w-full text-[10px] gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3" /> أرشفة
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
