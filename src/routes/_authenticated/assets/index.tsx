import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Upload,
  Image as ImageIcon,
  HardDrive,
  Layers,
  Link2Off,
  Copy,
  Grid3x3,
  List,
  FolderTree,
  Search,
} from "lucide-react";

type ViewMode = "grid" | "list" | "group";

export const Route = createFileRoute("/_authenticated/assets/")({
  head: () => ({ meta: [{ title: "إدارة الأصول — Alazab PAOP" }] }),
  component: AssetsIndex,
});

function AssetsIndex() {
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["assets-stats"],
    queryFn: async () => {
      const [{ count: total }, { count: linked }, { data: bytes }] = await Promise.all([
        supabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("product_assets").select("*", { count: "exact", head: true }),
        supabase.from("assets").select("file_size").eq("status", "active"),
      ]);
      const totalBytes = (bytes ?? []).reduce((s, r: any) => s + (r.file_size || 0), 0);
      return { total: total ?? 0, linked: linked ?? 0, totalBytes };
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["assets-list", search],
    queryFn: async () => {
      const q = supabase
        .from("product_assets")
        .select(
          "id, asset_role, sort_order, created_at, product:products(id, az_code, name_ar), asset:assets(id, file_name, file_url, file_type, file_size, folder_path, status)",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (search.trim()) {
        // filter client-side after fetch (small set)
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows ?? [];
    return (rows ?? []).filter(
      (r: any) =>
        r.asset?.file_name?.toLowerCase().includes(s) ||
        r.product?.az_code?.toLowerCase().includes(s) ||
        r.product?.name_ar?.toLowerCase().includes(s),
    );
  }, [rows, search]);

  return (
    <div className="p-6 space-y-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">إدارة الأصول</h1>
          <p className="text-sm text-muted-foreground mt-1">صور المنتجات والملفات المرتبطة</p>
        </div>
        <div className="flex gap-2">
          <Link to="/assets/unlinked">
            <Button variant="outline" className="gap-2">
              <Link2Off className="size-4" /> غير المرتبطة
            </Button>
          </Link>
          <Link to="/assets/duplicates">
            <Button variant="outline" className="gap-2">
              <Copy className="size-4" /> المكررة
            </Button>
          </Link>
          <Link to="/assets/bulk-upload">
            <Button className="gap-2">
              <Upload className="size-4" /> رفع مجلد كامل
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="إجمالي الأصول النشطة"
          value={(stats?.total ?? 0).toLocaleString("en")}
          icon={ImageIcon}
        />
        <StatCard
          label="ارتباطات بمنتجات"
          value={(stats?.linked ?? 0).toLocaleString("en")}
          icon={Layers}
        />
        <StatCard
          label="حجم التخزين"
          value={formatBytes(stats?.totalBytes ?? 0)}
          icon={HardDrive}
        />
      </div>

      <Card className="p-5 surface-elevated border-0 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث باسم الملف أو AZ Code أو اسم المنتج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as ViewMode)}
          >
            <ToggleGroupItem value="grid" aria-label="Grid">
              <Grid3x3 className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List">
              <List className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="group" aria-label="By Product">
              <FolderTree className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            لا توجد نتائج.{" "}
            <Link to="/assets/bulk-upload" className="text-accent">
              ابدأ بالرفع
            </Link>
            .
          </div>
        ) : view === "grid" ? (
          <GridView rows={filtered} />
        ) : view === "list" ? (
          <ListView rows={filtered} />
        ) : (
          <GroupView rows={filtered} />
        )}
      </Card>
    </div>
  );
}

function GridView({ rows }: { rows: any[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3">
      {rows.map((r) => (
        <Link
          key={r.id}
          to="/products/$id"
          params={{ id: r.product?.id ?? "" }}
          className="group relative aspect-square rounded-md overflow-hidden bg-muted border hover:ring-2 hover:ring-accent transition"
          title={`${r.product?.az_code} — ${r.asset?.file_name}`}
        >
          {r.asset?.file_type?.startsWith("image/") ? (
            <img
              src={r.asset.file_url}
              alt={r.asset.file_name}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full grid place-items-center text-[10px] text-muted-foreground p-2 text-center">
              {r.asset?.file_name}
            </div>
          )}
          {r.asset_role === "main_image" && (
            <div className="absolute top-1 right-1 bg-accent text-accent-foreground text-[9px] px-1.5 py-0.5 rounded font-semibold">
              MAIN
            </div>
          )}
          <div
            className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[9px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition num"
            dir="ltr"
          >
            {r.product?.az_code}
          </div>
        </Link>
      ))}
    </div>
  );
}

function ListView({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b">
          <tr className="text-right">
            <th className="p-2">معاينة</th>
            <th className="p-2">اسم الملف</th>
            <th className="p-2">المنتج</th>
            <th className="p-2">AZ Code</th>
            <th className="p-2">الدور</th>
            <th className="p-2">النوع</th>
            <th className="p-2">الحجم</th>
            <th className="p-2">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/30">
              <td className="p-2 w-12">
                <div className="size-10 rounded overflow-hidden bg-muted">
                  {r.asset?.file_type?.startsWith("image/") && (
                    <img
                      src={r.asset.file_url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                </div>
              </td>
              <td className="p-2 truncate max-w-[200px]">{r.asset?.file_name}</td>
              <td className="p-2 truncate max-w-[200px]">
                <Link
                  to="/products/$id"
                  params={{ id: r.product?.id ?? "" }}
                  className="text-accent hover:underline"
                >
                  {r.product?.name_ar}
                </Link>
              </td>
              <td className="p-2 num text-xs" dir="ltr">
                {r.product?.az_code}
              </td>
              <td className="p-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                  {r.asset_role}
                </span>
              </td>
              <td className="p-2 text-xs text-muted-foreground" dir="ltr">
                {r.asset?.file_type}
              </td>
              <td className="p-2 num text-xs" dir="ltr">
                {formatBytes(r.asset?.file_size ?? 0)}
              </td>
              <td className="p-2 num text-xs" dir="ltr">
                {new Date(r.created_at).toLocaleDateString("en-GB")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupView({ rows }: { rows: any[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, { product: any; items: any[] }>();
    rows.forEach((r) => {
      const key = r.product?.az_code ?? "—";
      if (!m.has(key)) m.set(key, { product: r.product, items: [] });
      m.get(key)!.items.push(r);
    });
    return Array.from(m.values()).sort((a, b) =>
      (a.product?.az_code || "").localeCompare(b.product?.az_code || ""),
    );
  }, [rows]);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.product?.az_code} className="space-y-2">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="min-w-0">
              <div className="font-bold truncate">{g.product?.name_ar}</div>
              <div className="text-xs num text-muted-foreground" dir="ltr">
                {g.product?.az_code}
              </div>
            </div>
            <Link
              to="/products/$id"
              params={{ id: g.product?.id ?? "" }}
              className="text-xs text-accent hover:underline shrink-0"
            >
              فتح المنتج ←
            </Link>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {g.items
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((r: any) => (
                <div
                  key={r.id}
                  className="relative aspect-square rounded overflow-hidden bg-muted border"
                >
                  {r.asset?.file_type?.startsWith("image/") && (
                    <img
                      src={r.asset.file_url}
                      alt={r.asset.file_name}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                  {r.asset_role === "main_image" && (
                    <div className="absolute top-1 right-1 bg-accent text-accent-foreground text-[8px] px-1 py-0.5 rounded font-bold">
                      M
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <Card className="p-5 surface-elevated border-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1 num" dir="ltr">
            {value}
          </div>
        </div>
        <div className="size-10 rounded-md bg-accent/15 text-accent grid place-items-center">
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

function formatBytes(b: number) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}
