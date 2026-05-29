import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const productSchema = z.object({
  name_ar: z.string().min(2, "الاسم العربي مطلوب"),
  name_en: z.string().min(2, "الاسم الانجليزي مطلوب"),
  az_code: z.string().min(1, "رمز AZ مطلوب"),
  item_type: z.enum(["product", "service", "work_item", "material", "tool", "spare_part", "finish_item", "custom_unit", "supplier_item", "package", "bundle"], {
    errorMap: () => ({ message: "نوع البند مطلوب" }),
  }),
  gpc_family: z.string().optional(),
  sector_ar: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

// Type for Supabase insert
type SupabaseProductInsert = {
  name_ar: string;
  name_en: string;
  az_code: string;
  item_type: ProductFormData["item_type"];
  gpc_family?: string;
  sector_ar?: string;
  description_ar?: string;
  description_en?: string;
  status: "draft" | "needs_review" | "duplicate_suspected" | "content_incomplete" | "pricing_incomplete" | "supplier_pending" | "approved" | "rejected" | "exported" | "archived";
};

interface ProductFormProps {
  initialData?: Partial<ProductFormData> & { id?: string };
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ProductForm({
  initialData,
  onSuccess,
  onCancel,
  isLoading: externalLoading,
}: ProductFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData,
  });

  const itemType = watch("item_type");

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    try {
      const payload: SupabaseProductInsert = {
        name_ar: data.name_ar,
        name_en: data.name_en,
        az_code: data.az_code,
        item_type: data.item_type,
        gpc_family: data.gpc_family,
        sector_ar: data.sector_ar,
        description_ar: data.description_ar,
        description_en: data.description_en,
        status: "draft",
      };

      if (initialData?.id) {
        // Update existing
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", initialData.id);

        if (error) throw error;
        toast.success("تم تحديث البند بنجاح");
        onSuccess?.(initialData.id);
      } else {
        // Create new
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert([payload])
          .select("id")
          .single();

        if (error) throw error;
        toast.success("تم إنشاء البند بنجاح");
        onSuccess?.(newProduct.id);
      }
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ");
    } finally {
      setIsLoading(false);
    }
  };

  const loading = isLoading || externalLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name_ar">الاسم بالعربي *</Label>
          <Input
            id="name_ar"
            placeholder="اسم البند بالعربية"
            {...register("name_ar")}
            disabled={loading}
          />
          {errors.name_ar && (
            <p className="text-xs text-destructive">{errors.name_ar.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name_en">الاسم بالانجليزي *</Label>
          <Input
            id="name_en"
            placeholder="Product name in English"
            {...register("name_en")}
            disabled={loading}
            dir="ltr"
          />
          {errors.name_en && (
            <p className="text-xs text-destructive">{errors.name_en.message}</p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="az_code">رمز AZ *</Label>
          <Input
            id="az_code"
            placeholder="AZ-001"
            {...register("az_code")}
            disabled={loading}
            dir="ltr"
          />
          {errors.az_code && (
            <p className="text-xs text-destructive">{errors.az_code.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="item_type">نوع البند *</Label>
          <Select
            value={itemType}
            onValueChange={(value) => setValue("item_type", value as any)}
            disabled={loading}
          >
            <SelectTrigger id="item_type">
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
          {errors.item_type && (
            <p className="text-xs text-destructive">{errors.item_type.message}</p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gpc_family">العائلة (GPC)</Label>
          <Input
            id="gpc_family"
            placeholder="مثال: الالكترونيات"
            {...register("gpc_family")}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sector_ar">القطاع</Label>
          <Input
            id="sector_ar"
            placeholder="مثال: البيع بالتجزئة"
            {...register("sector_ar")}
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description_ar">الوصف (عربي)</Label>
        <Textarea
          id="description_ar"
          placeholder="وصف تفصيلي للبند بالعربية..."
          {...register("description_ar")}
          disabled={loading}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description_en">الوصف (انجليزي)</Label>
        <Textarea
          id="description_en"
          placeholder="Detailed description in English..."
          {...register("description_en")}
          disabled={loading}
          rows={4}
          dir="ltr"
        />
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          إلغاء
        </Button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initialData?.id ? "تحديث البند" : "إنشاء البند"}
        </Button>
      </div>
    </form>
  );
}
