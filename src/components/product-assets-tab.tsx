import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  uploadAndLinkAsset,
  deleteAssetLink,
  promoteToMain,
  reorderAssets,
  addAssetFromUrl,
} from "@/lib/upload-assets";
import { generateProductImages } from "@/lib/product-image-gen.functions";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Star, ImageOff, Maximize2, Link as LinkIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SortableAssetGrid, type GridItem } from "@/components/sortable-asset-grid";
import { AssetLightbox } from "@/components/asset-lightbox";

type Row = {
  id: string;
  asset_role: string;
  sort_order: number;
  created_at: string;
  asset: {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string | null;
    file_size: number | null;
  } | null;
};

export function ProductAssetsTab({ productId, azCode }: { productId: string; azCode: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(-1);

  const { data: rows, isLoading } = useQuery<Row[]>({
    queryKey: ["product-assets", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_assets")
        .select(
          "id, asset_role, sort_order, created_at, asset:assets(id, file_name, file_url, file_type, file_size)",
        )
        .eq("product_id", productId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const main = useMemo(() => rows?.find((r) => r.asset_role === "main_image") ?? null, [rows]);
  const gallery = useMemo(
    () => (rows ?? []).filter((r) => r.asset_role !== "main_image" && r.asset),
    [rows],
  );

  const gridItems: GridItem[] = useMemo(() => {
    const all = (rows ?? []).filter((r) => r.asset);
    return all.map((r) => ({
      linkId: r.id,
      url: r.asset!.file_url,
      fileName: r.asset!.file_name,
      fileType: r.asset!.file_type,
      role: r.asset_role,
      uploadedAt: r.created_at,
      isMain: r.asset_role === "main_image",
    }));
  }, [rows]);

  const lightboxItems = gridItems.map((g) => ({
    linkId: g.linkId,
    src: g.url,
    alt: g.fileName,
    isMain: g.isMain,
  }));

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      const existing = rows?.length ?? 0;
      const hasMain = !!main;
      let added = 0;
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (!f.type.startsWith("image/") && !f.type.startsWith("application/")) continue;
          const isFirst = !hasMain && existing === 0 && i === 0;
          await uploadAndLinkAsset({
            file: f,
            productId,
            azCode,
            role: isFirst ? "main_image" : "gallery",
            sortOrder: existing + i,
            folderPath: azCode,
          });
          added++;
        }
        toast.success(`تم رفع ${added} ملف`);
        qc.invalidateQueries({ queryKey: ["product-assets", productId] });
      } catch (e: any) {
        toast.error(e.message ?? "فشل الرفع");
      } finally {
        setBusy(false);
      }
    },
    [rows, main, productId, azCode, qc],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    upload(Array.from(e.dataTransfer.files));
  };

  const onSetMain = async (linkId: string) => {
    try {
      await promoteToMain(productId, linkId);
      qc.invalidateQueries({ queryKey: ["product-assets", productId] });
      toast.success("تم تعيين الصورة الرئيسية");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onUnlink = async (linkId: string) => {
    try {
      await deleteAssetLink(linkId);
      qc.invalidateQueries({ queryKey: ["product-assets", productId] });
      setLightboxIdx(-1);
      toast.success("تم فك ربط الصورة");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onReorder = async (next: GridItem[]) => {
    qc.setQueryData<Row[]>(["product-assets", productId], (old) => {
      if (!old) return old;
      const byId = new Map(old.map((r) => [r.id, r]));
      return next.map((n, idx) => ({ ...(byId.get(n.linkId) as Row), sort_order: idx }));
    });
    try {
      await reorderAssets(next.map((n) => n.linkId));
    } catch (e: any) {
      toast.error("فشل حفظ الترتيب");
      qc.invalidateQueries({ queryKey: ["product-assets", productId] });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero: Main image + dropzone */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 surface-elevated border-0 overflow-hidden">
          {main?.asset?.file_url ? (
            <button
              type="button"
              onClick={() => setLightboxIdx(gridItems.findIndex((g) => g.isMain))}
              className="relative block w-full bg-muted group"
            >
              <img
                src={main.asset.file_url}
                alt={main.asset.file_name}
                className="w-full max-h-[480px] object-contain bg-gradient-to-br from-secondary/40 to-background"
              />
              <Badge className="absolute top-3 right-3 bg-accent text-accent-foreground gap-1 shadow-lg">
                <Star className="size-3 fill-current" /> Main Image
              </Badge>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition grid place-items-center">
                <Maximize2 className="size-8 text-white opacity-0 group-hover:opacity-100 transition" />
              </div>
              <div className="p-3 text-right border-t bg-card">
                <div className="text-sm font-semibold truncate">{main.asset.file_name}</div>
                <div className="text-xs text-muted-foreground num" dir="ltr">
                  {azCode}
                </div>
              </div>
            </button>
          ) : (
            <div className="aspect-[16/9] grid place-items-center text-muted-foreground gap-2 flex-col">
              <ImageOff className="size-10 opacity-50" />
              <div className="text-sm">لا توجد صورة رئيسية بعد</div>
            </div>
          )}
        </Card>

        <Card
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={`p-6 surface-elevated border-2 border-dashed transition flex flex-col items-center justify-center text-center gap-3 ${dragOver ? "border-accent bg-accent/5" : "border-border"}`}
        >
          <div className="size-12 rounded-full bg-accent/15 grid place-items-center">
            <Upload className="size-5 text-accent" />
          </div>
          <div>
            <div className="font-semibold">اسحب وأفلت الصور</div>
            <div className="text-xs text-muted-foreground mt-1">أو اختر من الجهاز</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => upload(Array.from(e.target.files ?? []))}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            variant="outline"
            size="sm"
          >
            {busy ? "جاري الرفع..." : "اختر ملفات"}
          </Button>
          <div className="text-[10px] text-muted-foreground num" dir="ltr">
            {gridItems.length} ملف
          </div>
        </Card>
      </div>

      {/* Gallery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Gallery</h3>
          <div className="text-xs text-muted-foreground num" dir="ltr">
            {gallery.length} items
          </div>
        </div>
        {!gridItems.length ? (
          <Card className="p-10 surface-elevated border-0 text-center text-muted-foreground">
            <ImageOff className="size-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">لا توجد أصول مرتبطة بهذا المنتج بعد</div>
          </Card>
        ) : (
          <SortableAssetGrid
            items={gridItems}
            onReorder={onReorder}
            onOpen={(i) => setLightboxIdx(i)}
          />
        )}
      </div>

      <AssetLightbox
        items={lightboxItems}
        index={lightboxIdx}
        onClose={() => setLightboxIdx(-1)}
        onSetMain={onSetMain}
        onUnlink={onUnlink}
      />
    </div>
  );
}
