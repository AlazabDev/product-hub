import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Sparkles,
  Loader2,
  Upload,
  Image as ImageIcon,
  Box,
  FileText,
  X,
  Save,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateProductContent,
  type GeneratedContent,
} from "@/lib/product-content-gen.functions";
import { uploadAndLinkAsset, type AssetRole } from "@/lib/upload-assets";

export const Route = createFileRoute("/_authenticated/products/new")({
  head: () => ({ meta: [{ title: "إنشاء بند جديد — Alazab PAOP" }] }),
  component: NewProductPage,
});

const schema = z.object({
  name_ar: z.string().min(2, "الاسم العربي مطلوب"),
  name_en: z.string().min(2, "الاسم الإنجليزي مطلوب"),
  az_code: z.string().min(1, "رمز AZ مطلوب"),
  item_type: z.enum([
    "product",
    "service",
    "work_item",
    "material",
    "tool",
    "spare_part",
    "finish_item",
    "bundle",
  ]),
  gpc_family: z.string().optional(),
  sector_ar: z.string().optional(),
  short_description_ar: z.string().optional(),
  short_description_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  marketing_content: z.string().optional(),
  technical_content: z.string().optional(),
  warranty_info: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type QueuedFile = {
  file: File;
  role: AssetRole;
  kind: "image" | "model_3d" | "cad" | "document";
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MODEL_3D_EXT = ["glb", "gltf", "stl", "obj", "fbx", "3ds", "ply"];
const CAD_EXT = ["step", "stp", "iges", "igs", "dwg", "dxf", "sat"];

function classifyFile(file: File): QueuedFile["kind"] {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (MODEL_3D_EXT.includes(ext)) return "model_3d";
  if (CAD_EXT.includes(ext)) return "cad";
  return "document";
}

function fileToRole(kind: QueuedFile["kind"]): AssetRole {
  switch (kind) {
    case "image":
      return "gallery";
    case "model_3d":
      return "model_3d";
    case "cad":
      return "cad_file";
    default:
      return "datasheet";
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function NewProductPage() {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState("");
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      item_type: "product",
    },
  });

  const itemType = watch("item_type");

  const genFn = useServerFn(generateProductContent);
  const gen = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          keywords,
          itemType,
          sector: watch("sector_ar"),
          gpcFamily: watch("gpc_family"),
        },
      }),
    onSuccess: (data: GeneratedContent) => {
      const fields: (keyof GeneratedContent)[] = [
        "name_ar",
        "name_en",
        "short_description_ar",
        "short_description_en",
        "description_ar",
        "description_en",
        "marketing_content",
        "technical_content",
        "warranty_info",
        "gpc_family",
        "sector_ar",
      ];
      let filled = 0;
      for (const k of fields) {
        const v = data[k];
        if (typeof v === "string" && v.trim()) {
          setValue(k as keyof FormData, v, { shouldDirty: true, shouldValidate: true });
          filled++;
        }
      }
      // suggest az_code if empty
      if (!watch("az_code") && data.name_en) {
        const slug = data.name_en
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 24);
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        setValue("az_code", `AZ-${slug}-${suffix}`);
      }
      toast.success(`أنشأ المساعد ${filled} حقلاً`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const queued: QueuedFile[] = arr.map((f) => {
      const kind = classifyFile(f);
      return { file: f, kind, role: fileToRole(kind) };
    });
    setQueue((p) => [...p, ...queued]);
  };

  const removeQueued = (idx: number) => setQueue((p) => p.filter((_, i) => i !== idx));

  const onSave = async (form: FormData) => {
    setSaving(true);
    try {
      const { data: created, error } = await supabase
        .from("products")
        .insert([{ ...form, status: "draft" }])
        .select("id, az_code")
        .single();
      if (error) throw error;

      // Upload queued files
      let uploaded = 0;
      let failed = 0;
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        try {
          // First image becomes main
          const role: AssetRole =
            q.kind === "image" && uploaded === 0 && queue[0].kind === "image"
              ? "main_image"
              : q.role;
          await uploadAndLinkAsset({
            file: q.file,
            productId: created.id,
            azCode: created.az_code,
            role,
            sortOrder: i,
            folderPath: created.az_code,
          });
          uploaded++;
        } catch (err: any) {
          failed++;
          console.error("upload failed", q.file.name, err);
        }
      }

      toast.success(
        `تم إنشاء البند${uploaded ? ` ورفع ${uploaded} ملف` : ""}${failed ? ` (فشل ${failed})` : ""}`,
      );
      reset();
      setQueue([]);
      navigate({ to: "/products/$id", params: { id: created.id } });
    } catch (e: any) {
      toast.error(e.message ?? "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const queuedImages = queue.filter((q) => q.kind === "image").length;
  const queued3d = queue.filter((q) => q.kind === "model_3d" || q.kind === "cad").length;
  const queuedDocs = queue.filter((q) => q.kind === "document").length;

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            to="/products"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowRight className="size-3" /> العودة للقائمة
          </Link>
          <h1 className="text-2xl font-bold mt-1">إنشاء بند جديد</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            اكتب الكلمات المفتاحية ودع المساعد ينشئ المحتوى، ثم ارفع الصور والملفات ثلاثية الأبعاد
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-4">
        {/* AI Generator Strip */}
        <Card className="p-5 surface-elevated border-0 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-md bg-accent/20 grid place-items-center">
              <Wand2 className="size-4 text-accent" />
            </div>
            <div>
              <div className="font-bold">المساعد الذكي للمحتوى</div>
              <div className="text-xs text-muted-foreground">
                اكتب الكلمات المفتاحية واضغط إنشاء — سيُملأ المحتوى تلقائياً
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="مثال: ماكينة لحام ميج 250 أمبير، تبريد هوائي، ضمان سنتين..."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="flex-1 min-w-[260px]"
            />
            <Select
              value={itemType}
              onValueChange={(v) => setValue("item_type", v as FormData["item_type"])}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">منتج</SelectItem>
                <SelectItem value="service">خدمة</SelectItem>
                <SelectItem value="work_item">عمل</SelectItem>
                <SelectItem value="material">مادة</SelectItem>
                <SelectItem value="tool">أداة</SelectItem>
                <SelectItem value="spare_part">قطعة غيار</SelectItem>
                <SelectItem value="finish_item">منتج نهائي</SelectItem>
                <SelectItem value="bundle">حزمة</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              className="gap-2"
              onClick={() => gen.mutate()}
              disabled={gen.isPending || keywords.trim().length < 2}
            >
              {gen.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              إنشاء المحتوى
            </Button>
          </div>
        </Card>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5 surface-elevated border-0 space-y-4">
              <h2 className="font-bold">المعلومات الأساسية</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="الاسم بالعربي *" error={errors.name_ar?.message}>
                  <Input {...register("name_ar")} placeholder="اسم البند بالعربية" />
                </Field>
                <Field label="الاسم بالإنجليزي *" error={errors.name_en?.message}>
                  <Input {...register("name_en")} placeholder="Name in English" dir="ltr" />
                </Field>
                <Field label="رمز AZ *" error={errors.az_code?.message}>
                  <Input {...register("az_code")} placeholder="AZ-XXX-0001" dir="ltr" />
                </Field>
                <Field label="نوع البند *">
                  <Select
                    value={itemType}
                    onValueChange={(v) => setValue("item_type", v as FormData["item_type"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">منتج</SelectItem>
                      <SelectItem value="service">خدمة</SelectItem>
                      <SelectItem value="work_item">عمل</SelectItem>
                      <SelectItem value="material">مادة</SelectItem>
                      <SelectItem value="tool">أداة</SelectItem>
                      <SelectItem value="spare_part">قطعة غيار</SelectItem>
                      <SelectItem value="finish_item">منتج نهائي</SelectItem>
                      <SelectItem value="bundle">حزمة</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="العائلة (GPC)">
                  <Input {...register("gpc_family")} placeholder="مثال: معدات اللحام" />
                </Field>
                <Field label="القطاع">
                  <Input {...register("sector_ar")} placeholder="مثال: الصناعة" />
                </Field>
              </div>
            </Card>

            <Card className="p-5 surface-elevated border-0 space-y-4">
              <h2 className="font-bold">الوصف</h2>
              <Field label="وصف قصير (عربي)">
                <Textarea
                  {...register("short_description_ar")}
                  rows={2}
                  placeholder="سطر واحد جذاب..."
                />
              </Field>
              <Field label="Short description (English)">
                <Textarea
                  {...register("short_description_en")}
                  rows={2}
                  placeholder="One catchy line..."
                  dir="ltr"
                />
              </Field>
              <Field label="الوصف التفصيلي (عربي)">
                <Textarea {...register("description_ar")} rows={5} />
              </Field>
              <Field label="Detailed description (English)">
                <Textarea {...register("description_en")} rows={5} dir="ltr" />
              </Field>
            </Card>

            <Card className="p-5 surface-elevated border-0 space-y-4">
              <h2 className="font-bold">المحتوى الاحترافي</h2>
              <Field label="المحتوى التسويقي">
                <Textarea
                  {...register("marketing_content")}
                  rows={4}
                  placeholder="فوائد المنتج، نقاط البيع..."
                />
              </Field>
              <Field label="المحتوى الفني">
                <Textarea
                  {...register("technical_content")}
                  rows={4}
                  placeholder="المواصفات، الأبعاد، المتطلبات..."
                />
              </Field>
              <Field label="معلومات الضمان">
                <Textarea {...register("warranty_info")} rows={2} />
              </Field>
            </Card>
          </div>

          {/* Right column: uploads */}
          <div className="space-y-4">
            <Card
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              className={`p-5 surface-elevated border-2 border-dashed transition flex flex-col items-center text-center gap-3 ${
                dragOver ? "border-accent bg-accent/5" : "border-border"
              }`}
            >
              <div className="size-12 rounded-full bg-accent/15 grid place-items-center">
                <Upload className="size-5 text-accent" />
              </div>
              <div>
                <div className="font-semibold">ارفع الملفات</div>
                <div className="text-xs text-muted-foreground mt-1">
                  صور · نماذج ثلاثية الأبعاد · ملفات CAD · مستندات
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.glb,.gltf,.stl,.obj,.fbx,.3ds,.ply,.step,.stp,.iges,.igs,.dwg,.dxf,.sat,.pdf"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                اختر ملفات
              </Button>
              <div className="flex gap-2 flex-wrap text-xs">
                <Badge variant="outline" className="gap-1">
                  <ImageIcon className="size-3" />
                  {queuedImages} صورة
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Box className="size-3" />
                  {queued3d} ثلاثي الأبعاد/CAD
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <FileText className="size-3" />
                  {queuedDocs} مستند
                </Badge>
              </div>
            </Card>

            {queue.length > 0 && (
              <Card className="p-4 surface-elevated border-0 space-y-2">
                <div className="font-semibold text-sm mb-2">
                  قائمة الرفع ({queue.length})
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {queue.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded border bg-card text-xs"
                    >
                      {q.kind === "image" ? (
                        <ImageIcon className="size-3.5 text-accent shrink-0" />
                      ) : q.kind === "model_3d" || q.kind === "cad" ? (
                        <Box className="size-3.5 text-accent shrink-0" />
                      ) : (
                        <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{q.file.name}</div>
                        <div className="text-muted-foreground">
                          {formatSize(q.file.size)} · {q.role}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-6 p-0"
                        onClick={() => removeQueued(i)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-4 surface-elevated border-0 space-y-3 sticky top-16">
              <div className="text-xs text-muted-foreground">
                سيُحفظ البند كمسودة ويمكن إرساله للاعتماد لاحقاً.
              </div>
              <Button type="submit" className="w-full gap-2" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                حفظ البند {queue.length > 0 ? `ورفع ${queue.length} ملف` : ""}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate({ to: "/products" })}
                disabled={saving}
              >
                إلغاء
              </Button>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
