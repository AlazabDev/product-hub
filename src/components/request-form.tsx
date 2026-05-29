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

const requestSchema = z.object({
  title: z.string().min(3, "العنوان مطلوب"),
  description: z.string().min(10, "الوصف يجب أن يكون أطول"),
  request_type: z.enum(["new_product", "new_service", "bulk_order", "special_request"], {
    errorMap: () => ({ message: "نوع الطلب مطلوب" }),
  }),
  priority: z.enum(["low", "medium", "high", "urgent"], {
    errorMap: () => ({ message: "الأولوية مطلوبة" }),
  }),
  category: z.string().optional(),
  quantity: z.string().optional(),
  estimated_budget: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestFormProps {
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function RequestForm({
  onSuccess,
  onCancel,
  isLoading: externalLoading,
}: RequestFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      priority: "medium",
      request_type: "new_product",
    },
  });

  const requestType = watch("request_type");
  const priority = watch("priority");

  const onSubmit = async (data: RequestFormData) => {
    setIsLoading(true);
    try {
      const { data: newRequest, error } = await supabase
        .from("product_requests")
        .insert([
          {
            title: data.title,
            description: data.description,
            request_type: data.request_type as "product" | "service" | "material" | "pricing_inquiry" | "supplier_connection",
            priority: data.priority as "low" | "medium" | "high" | "urgent",
            category: data.category || null,
            quantity: data.quantity ? parseInt(data.quantity) : null,
            estimated_budget: data.estimated_budget
              ? parseFloat(data.estimated_budget)
              : null,
            status: "open" as "open" | "in_review" | "approved" | "rejected",
          } as any,
        ])
        .select("id")
        .single();

      if (error) throw error;
      toast.success("تم إنشاء الطلب بنجاح");
      onSuccess?.(newRequest.id);
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ");
    } finally {
      setIsLoading(false);
    }
  };

  const loading = isLoading || externalLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">عنوان الطلب *</Label>
        <Input
          id="title"
          placeholder="مثال: منتج جديد من الفئة X"
          {...register("title")}
          disabled={loading}
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="request_type">نوع الطلب *</Label>
          <Select
            value={requestType}
            onValueChange={(value) => setValue("request_type", value as any)}
            disabled={loading}
          >
            <SelectTrigger id="request_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new_product">منتج جديد</SelectItem>
              <SelectItem value="new_service">خدمة جديدة</SelectItem>
              <SelectItem value="bulk_order">طلب كمي</SelectItem>
              <SelectItem value="special_request">طلب خاص</SelectItem>
            </SelectContent>
          </Select>
          {errors.request_type && (
            <p className="text-xs text-destructive">{errors.request_type.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">الأولوية *</Label>
          <Select
            value={priority}
            onValueChange={(value) => setValue("priority", value as any)}
            disabled={loading}
          >
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">منخفضة</SelectItem>
              <SelectItem value="medium">متوسطة</SelectItem>
              <SelectItem value="high">عالية</SelectItem>
              <SelectItem value="urgent">عاجلة</SelectItem>
            </SelectContent>
          </Select>
          {errors.priority && (
            <p className="text-xs text-destructive">{errors.priority.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">الوصف التفصيلي *</Label>
        <Textarea
          id="description"
          placeholder="قم بوصف الطلب بالتفصيل..."
          {...register("description")}
          disabled={loading}
          rows={5}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">الفئة</Label>
          <Input
            id="category"
            placeholder="مثال: إلكترونيات"
            {...register("category")}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">الكمية المطلوبة</Label>
          <Input
            id="quantity"
            type="number"
            placeholder="مثال: 100"
            {...register("quantity")}
            disabled={loading}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimated_budget">الميزانية المتوقعة</Label>
          <Input
            id="estimated_budget"
            type="number"
            placeholder="مثال: 5000"
            {...register("estimated_budget")}
            disabled={loading}
            dir="ltr"
          />
        </div>
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
          إنشاء الطلب
        </Button>
      </div>
    </form>
  );
}
