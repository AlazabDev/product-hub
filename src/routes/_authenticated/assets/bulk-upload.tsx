import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { uploadAndLinkAsset } from "@/lib/upload-assets";
import {
  ArrowRight,
  FolderTree,
  Play,
  CheckCircle2,
  AlertCircle,
  X,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assets/bulk-upload")({
  head: () => ({ meta: [{ title: "رفع مجلد كامل — Alazab PAOP" }] }),
  component: BulkUploadPage,
});

type FolderEntry = {
  azCode: string;
  files: File[];
  productId?: string | null;
  productName?: string | null;
  status: "pending" | "matching" | "ready" | "uploading" | "done" | "skipped" | "error";
  uploaded: number;
  error?: string;
};

const AZ_REGEX = /^AZ-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-\d+$/i;

function pickFolderName(file: File): string | null {
  // webkitRelativePath: "RootFolder/AZ-ABR-01-25-1939/img1.jpg"
  const rel = (file as any).webkitRelativePath as string | undefined;
  if (!rel) return null;
  const parts = rel.split("/").filter(Boolean);
  // find a segment that looks like AZ code; fall back to immediate parent
  for (let i = parts.length - 2; i >= 0; i--) {
    if (AZ_REGEX.test(parts[i])) return parts[i].toUpperCase();
  }
  return parts.length >= 2 ? parts[parts.length - 2].toUpperCase() : null;
}

function BulkUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const total = useMemo(() => folders.reduce((s, f) => s + f.files.length, 0), [folders]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    // Group by folder
    const map = new Map<string, File[]>();
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      const az = pickFolderName(f);
      if (!az) continue;
      if (!map.has(az)) map.set(az, []);
      map.get(az)!.push(f);
    }
    if (!map.size) {
      toast.error("لم يتم العثور على مجلدات بأسماء AZ Code صالحة");
      return;
    }

    // Match against products (chunked IN query)
    const codes = Array.from(map.keys());
    const found = new Map<string, { id: string; name: string }>();
    const chunk = 200;
    for (let i = 0; i < codes.length; i += chunk) {
      const slice = codes.slice(i, i + chunk);
      const { data } = await supabase
        .from("products")
        .select("id, az_code, name_ar")
        .in("az_code", slice);
      (data ?? []).forEach((p: any) =>
        found.set(p.az_code.toUpperCase(), { id: p.id, name: p.name_ar }),
      );
    }

    const entries: FolderEntry[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([az, fs]) => {
        const sorted = [...fs].sort((a, b) => a.name.localeCompare(b.name));
        const match = found.get(az);
        return {
          azCode: az,
          files: sorted,
          productId: match?.id ?? null,
          productName: match?.name ?? null,
          status: match ? "ready" : "skipped",
          uploaded: 0,
        };
      });

    setFolders(entries);
    setDone(0);
    const matched = entries.filter((e) => e.productId).length;
    toast.success(
      `تم تحليل ${entries.length} مجلد — ${matched} مطابق، ${entries.length - matched} غير موجود`,
    );
  };

  const startUpload = async () => {
    setRunning(true);
    setDone(0);
    const next = [...folders];

    // process folders sequentially, files within a folder also sequential to keep order
    for (let i = 0; i < next.length; i++) {
      const f = next[i];
      if (!f.productId) continue;
      next[i] = { ...f, status: "uploading" };
      setFolders([...next]);

      let uploaded = 0;
      try {
        for (let j = 0; j < f.files.length; j++) {
          const file = f.files[j];
          await uploadAndLinkAsset({
            file,
            productId: f.productId,
            azCode: f.azCode,
            role: j === 0 ? "main_image" : "gallery",
            sortOrder: j,
            folderPath: f.azCode,
          });
          uploaded++;
          next[i] = { ...next[i], uploaded };
          setDone((d) => d + 1);
          setFolders([...next]);
        }
        next[i] = { ...next[i], status: "done" };
      } catch (err: any) {
        next[i] = { ...next[i], status: "error", error: err.message ?? String(err) };
      }
      setFolders([...next]);
    }
    setRunning(false);
    toast.success("اكتمل الرفع");
  };

  const matched = folders.filter((f) => f.productId).length;
  const skipped = folders.length - matched;
  const matchedFiles = folders.filter((f) => f.productId).reduce((s, f) => s + f.files.length, 0);
  const progress = total ? Math.round((done / matchedFiles) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <Link
        to="/assets"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowRight className="size-3" /> العودة لإدارة الأصول
      </Link>

      <div>
        <h1 className="text-2xl font-bold">رفع مجلد صور المنتجات</h1>
        <p className="text-sm text-muted-foreground mt-1">
          اختر المجلد الرئيسي. النظام يقرأ كل مجلد فرعي على أنه AZ Code، ويربط الصور تلقائياً
          بالمنتج المطابق. أول صورة (أبجدياً) = صورة رئيسية، والباقي = معرض.
        </p>
      </div>

      <Card className="p-6 surface-elevated border-0">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="size-12 rounded-md bg-accent/15 text-accent grid place-items-center shrink-0">
            <FolderTree className="size-6" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <div className="font-semibold mb-1">الخطوة 1 — اختر المجلد الرئيسي</div>
            <div className="text-xs text-muted-foreground mb-3">
              البنية المتوقعة:{" "}
              <code className="num bg-muted px-1.5 py-0.5 rounded text-[11px]" dir="ltr">
                Root/AZ-ABR-01-25-1939/img.jpg
              </code>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              // @ts-expect-error non-standard but widely supported
              webkitdirectory=""
              directory=""
              accept="image/*"
              onChange={onPick}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => inputRef.current?.click()}
                disabled={running}
                variant="outline"
                className="gap-2"
              >
                <FolderOpen className="size-4" /> اختيار المجلد
              </Button>
              {folders.length > 0 && (
                <Button onClick={startUpload} disabled={running || !matched} className="gap-2">
                  <Play className="size-4" /> بدء الرفع ({matchedFiles} صورة)
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {folders.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="مجلدات" value={folders.length} />
            <Stat label="مطابق" value={matched} cls="text-success" />
            <Stat label="بدون منتج" value={skipped} cls="text-warning" />
            <Stat label="إجمالي صور" value={total} />
          </div>

          {running && (
            <Card className="p-4 surface-elevated border-0">
              <div className="flex justify-between text-xs mb-2">
                <span>جاري الرفع...</span>
                <span className="num" dir="ltr">
                  {done} / {matchedFiles} ({progress}%)
                </span>
              </div>
              <Progress value={progress} />
            </Card>
          )}

          <Card className="p-0 surface-elevated border-0 overflow-hidden">
            <div className="max-h-[600px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="text-right">
                    <th className="p-3 font-semibold text-xs">AZ Code</th>
                    <th className="p-3 font-semibold text-xs">المنتج</th>
                    <th className="p-3 font-semibold text-xs text-center">الصور</th>
                    <th className="p-3 font-semibold text-xs text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {folders.map((f) => (
                    <tr key={f.azCode} className="border-t hover:bg-muted/30">
                      <td className="p-3 num text-xs" dir="ltr">
                        {f.azCode}
                      </td>
                      <td className="p-3 text-xs">
                        {f.productName || (
                          <span className="text-warning">— لا يوجد منتج بهذا الكود —</span>
                        )}
                      </td>
                      <td className="p-3 text-center num text-xs" dir="ltr">
                        {f.uploaded}/{f.files.length}
                      </td>
                      <td className="p-3 text-center">
                        <StatusBadge s={f} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: number; cls?: string }) {
  return (
    <Card className="p-4 surface-elevated border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold num mt-0.5 ${cls}`} dir="ltr">
        {value.toLocaleString("en")}
      </div>
    </Card>
  );
}

function StatusBadge({ s }: { s: FolderEntry }) {
  if (s.status === "done")
    return (
      <Badge className="bg-success/15 text-success hover:bg-success/15 gap-1">
        <CheckCircle2 className="size-3" /> تم
      </Badge>
    );
  if (s.status === "uploading") return <Badge variant="secondary">جاري الرفع...</Badge>;
  if (s.status === "error")
    return (
      <Badge variant="destructive" className="gap-1" title={s.error}>
        <AlertCircle className="size-3" /> خطأ
      </Badge>
    );
  if (s.status === "skipped")
    return (
      <Badge variant="outline" className="gap-1 text-warning">
        <X className="size-3" /> تخطّى
      </Badge>
    );
  return <Badge variant="outline">جاهز</Badge>;
}
