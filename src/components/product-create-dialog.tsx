import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ProductForm } from "./product-form";
import { Plus } from "lucide-react";

interface ProductCreateDialogProps {
  onSuccess?: (id: string) => void;
}

export function ProductCreateDialog({ onSuccess }: ProductCreateDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSuccess = (id: string) => {
    setOpen(false);
    onSuccess?.(id);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          إنشاء بند جديد
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>إنشاء بند جديد</SheetTitle>
          <SheetDescription>
            أضف بند جديد (منتج أو خدمة) إلى الكتالوج. يمكنك تحرير التفاصيل لاحقاً.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <ProductForm
            onSuccess={handleSuccess}
            onCancel={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
