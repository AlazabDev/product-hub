import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Download, Trash2, Link2, Grid2X2, List } from "lucide-react";

interface Asset {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  folder_path: string;
  created_at: string;
  status: string;
}

interface AssetGalleryProps {
  assets: Asset[];
  isLoading?: boolean;
  onDelete?: (id: string) => void;
  onLink?: (id: string) => void;
  onDownload?: (asset: Asset) => void;
  viewMode?: "grid" | "list";
}

export function AssetGallery({
  assets,
  isLoading,
  onDelete,
  onLink,
  onDownload,
  viewMode: initialViewMode = "grid",
}: AssetGalleryProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(initialViewMode);

  const filtered = assets.filter(
    (a) =>
      a.file_name.toLowerCase().includes(search.toLowerCase()) ||
      a.folder_path.toLowerCase().includes(search.toLowerCase()),
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const isImage = (type: string) => type.startsWith("image/");

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array(8)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-secondary animate-pulse" />
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="البحث عن أصل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <div className="flex gap-1 border rounded-lg p-1">
          <Button
            size="sm"
            variant={viewMode === "grid" ? "default" : "ghost"}
            onClick={() => setViewMode("grid")}
            className="gap-1"
          >
            <Grid2X2 className="size-4" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === "list" ? "default" : "ghost"}
            onClick={() => setViewMode("list")}
            className="gap-1"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center surface-elevated border-0">
          <div className="text-muted-foreground">
            {assets.length === 0 ? "لا توجد أصول" : "لم يتم العثور على نتائج البحث"}
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="group relative rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
            >
              {isImage(asset.file_type) ? (
                <img
                  src={asset.file_url}
                  alt={asset.file_name}
                  className="w-full aspect-square object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full aspect-square bg-secondary grid place-items-center text-muted-foreground text-sm">
                  {asset.file_type.split("/")[1]?.toUpperCase() || "FILE"}
                </div>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 flex items-end p-2">
                <div className="space-y-1 w-full">
                  <div className="text-[10px] text-white truncate">{asset.file_name}</div>
                  <div className="flex gap-1">
                    {onLink && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 flex-1 gap-1 text-xs"
                        onClick={() => onLink(asset.id)}
                      >
                        <Link2 className="size-3" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 flex-1 gap-1 text-xs"
                        onClick={() => onDelete(asset.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden surface-elevated border-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-right p-3 font-semibold">الاسم</th>
                  <th className="text-right p-3 font-semibold">النوع</th>
                  <th className="text-right p-3 font-semibold">الحجم</th>
                  <th className="text-right p-3 font-semibold">المسار</th>
                  <th className="text-right p-3 font-semibold">التاريخ</th>
                  <th className="text-center p-3 font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => (
                  <tr key={asset.id} className="border-t hover:bg-secondary/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {isImage(asset.file_type) && (
                          <img
                            src={asset.file_url}
                            alt={asset.file_name}
                            className="w-8 h-8 rounded object-cover"
                          />
                        )}
                        <span className="truncate text-sm">{asset.file_name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {asset.file_type.split("/")[1]?.toUpperCase() || "—"}
                    </td>
                    <td className="p-3 text-xs num text-muted-foreground">
                      {formatFileSize(asset.file_size)}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground truncate">
                      {asset.folder_path || "—"}
                    </td>
                    <td className="p-3 text-xs num">
                      {new Date(asset.created_at).toLocaleDateString("ar")}
                    </td>
                    <td className="p-3 flex justify-center gap-2">
                      {onDownload && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onDownload(asset)}
                          title="تحميل"
                        >
                          <Download className="size-3" />
                        </Button>
                      )}
                      {onLink && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onLink(asset.id)}
                          title="ربط"
                        >
                          <Link2 className="size-3" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:text-destructive"
                          onClick={() => onDelete(asset.id)}
                          title="حذف"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="text-xs text-muted-foreground">
        عرض {filtered.length} من {assets.length} أصل
      </div>
    </div>
  );
}
