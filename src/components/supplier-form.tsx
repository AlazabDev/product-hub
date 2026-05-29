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

const supplierSchema = z.object({
  name_ar: z.string().min(2, "الاسم العربي مطلوب"),
  name_en: z.string().min(2, "الاسم الانجليزي مطلوب"),
  supplier_code: z.string().min(1, "رمز المورد مطلوب"),
  category: z.string().min(1, "الفئة مطلوبة"),
  tier: z.enum(["first_tier", "second_tier", "backup", "local"], {
    errorMap: () => ({ message: "مستوى المورد مطلوب" }),
  }),
  contact_person: z.string().optional(),
  email: z.string().email("بريد إلكتروني صحيح").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
  initialData?: Partial<SupplierFormData> & { id?: string };
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function SupplierForm({
  initialData,
  onSuccess,
  onCancel,
  isLoading: externalLoading,
}: SupplierFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: initialData || { tier: "first_tier" },
  });

  const tier = watch("tier");

  const onSubmit = async (data: SupplierFormData) => {
    setIsLoading(true);
    try {
      const payload: any = {
        name_ar: data.name_ar,
        name_en: data.name_en,
        supplier_code: data.supplier_code,
        category: data.category,
        tier: data.tier as "first_tier" | "second_tier" | "backup" | "local" | "imported" | "internal_workshop" | "factory" | "marketplace",
        contact_person: data.contact_person || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        notes: data.notes || null,
        status: "active",
      };

      if (initialData?.id) {
        // Update
        const { error } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", initialData.id);

        if (error) throw error;
        toast.success("تم تحديث المورد بنجاح");
        onSuccess?.(initialData.id);
      } else {
        // Create
        const { data: newSupplier, error } = await supabase
          .from("suppliers")
          .insert([payload])
          .select("id")
          .single();

        if (error) throw error;
        toast.success("تم إنشاء المورد بنجاح");
        onSuccess?.(newSupplier.id);
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
            placeholder="اسم المورد بالعربية"
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
            placeholder="Supplier name in English"
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
          <Label htmlFor="supplier_code">رمز المورد *</Label>
          <Input
            id="supplier_code"
            placeholder="SUP-001"
            {...register("supplier_code")}
            disabled={loading}
            dir="ltr"
          />
          {errors.supplier_code && (
            <p className="text-xs text-destructive">{errors.supplier_code.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">الفئة *</Label>
          <Input
            id="category"
            placeholder="مثال: الإلكترونيات"
            {...register("category")}
            disabled={loading}
          />
          {errors.category && (
            <p className="text-xs text-destructive">{errors.category.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tier">مستوى المورد *</Label>
        <Select
          value={tier}
          onValueChange={(value) => setValue("tier", value as any)}
          disabled={loading}
        >
          <SelectTrigger id="tier">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="first_tier">الدرجة الأولى</SelectItem>
            <SelectItem value="second_tier">الدرجة الثانية</SelectItem>
            <SelectItem value="backup">احتياطي</SelectItem>
            <SelectItem value="local">محلي</SelectItem>
          </SelectContent>
        </Select>
        {errors.tier && (
          <p className="text-xs text-destructive">{errors.tier.message}</p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact_person">جهة الاتصال</Label>
          <Input
            id="contact_person"
            placeholder="اسم جهة الاتصال"
            {...register("contact_person")}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            type="email"
            placeholder="email@supplier.com"
            {...register("email")}
            disabled={loading}
            dir="ltr"
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">الهاتف</Label>
          <Input
            id="phone"
            placeholder="+966 50 123 4567"
            {...register("phone")}
            disabled={loading}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">العنوان</Label>
          <Input
            id="address"
            placeholder="العنوان الكامل"
            {...register("address")}
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea
          id="notes"
          placeholder="ملاحظات إضافية عن المورد..."
          {...register("notes")}
          disabled={loading}
          rows={3}
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
          {initialData?.id ? "تحديث المورد" : "إنشاء المورد"}
        </Button>
      </div>
    </form>
  );
}
