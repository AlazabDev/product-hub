import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

export interface PricingRule {
  id?: string;
  name: string;
  condition: {
    field: "quantity" | "category" | "season" | "supplier" | "product_code";
    operator: "equals" | "greater_than" | "less_than" | "between" | "contains";
    value: string | string[];
  };
  adjustment: {
    type: "percentage" | "fixed";
    value: number;
    direction: "increase" | "decrease";
  };
  enabled: boolean;
}

interface PricingRuleEditorProps {
  rules: PricingRule[];
  onSave?: (rules: PricingRule[]) => Promise<void>;
  isLoading?: boolean;
}

export function PricingRuleEditor({
  rules: initialRules,
  onSave,
  isLoading,
}: PricingRuleEditorProps) {
  const [rules, setRules] = useState<PricingRule[]>(initialRules);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<PricingRule> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setFormData({ ...rules[index] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setFormData(null);
  };

  const saveRule = () => {
    if (!formData || !formData.name) {
      toast.error("الاسم مطلوب");
      return;
    }

    const updated = [...rules];
    if (editingIndex !== null) {
      updated[editingIndex] = formData as PricingRule;
    } else {
      updated.push({
        ...formData,
        id: `rule-${Date.now()}`,
      } as PricingRule);
    }

    setRules(updated);
    cancelEdit();
    toast.success(editingIndex !== null ? "تم تحديث القاعدة" : "تمت إضافة قاعدة جديدة");
  };

  const deleteRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
    toast.success("تم حذف القاعدة");
  };

  const toggleRule = (index: number) => {
    const updated = [...rules];
    updated[index].enabled = !updated[index].enabled;
    setRules(updated);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(rules);
      toast.success("تم حفظ القواعس بنجاح");
    } catch (error: any) {
      toast.error(error.message || "خطأ في الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const conditions = [
    { value: "quantity", label: "الكمية" },
    { value: "category", label: "الفئة" },
    { value: "season", label: "الموسم" },
    { value: "supplier", label: "المورد" },
    { value: "product_code", label: "رمز المنتج" },
  ];

  const operators = [
    { value: "equals", label: "يساوي" },
    { value: "greater_than", label: "أكبر من" },
    { value: "less_than", label: "أقل من" },
    { value: "between", label: "بين" },
    { value: "contains", label: "يحتوي على" },
  ];

  return (
    <div className="space-y-4">
      {/* Rules List */}
      <div className="space-y-2">
        {rules.length === 0 ? (
          <Card className="p-8 text-center surface-elevated border-0 text-muted-foreground">
            لا توجد قواعس تسعير
          </Card>
        ) : (
          rules.map((rule, idx) => (
            <Card
              key={rule.id || idx}
              className="p-4 surface-elevated border-0 hover:border-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`size-4 rounded border-2 mt-1 cursor-pointer transition-colors ${
                    rule.enabled
                      ? "bg-accent border-accent"
                      : "border-border hover:border-accent"
                  }`}
                  onClick={() => toggleRule(idx)}
                />

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold">{rule.name}</h4>
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <div>
                      الشرط: {conditions.find((c) => c.value === rule.condition.field)?.label}{" "}
                      {rule.condition.operator} {rule.condition.value}
                    </div>
                    <div>
                      التعديل:{" "}
                      {rule.adjustment.direction === "increase" ? "زيادة" : "انخفاض"}{" "}
                      {rule.adjustment.type === "percentage"
                        ? `${rule.adjustment.value}%`
                        : `${rule.adjustment.value}`}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(idx)}
                    className="h-8 w-8 p-0"
                  >
                    ✎
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRule(idx)}
                    className="h-8 w-8 p-0 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Editor Form */}
      {editingIndex !== null || formData ? (
        <Card className="p-5 surface-elevated border-0 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">
              {editingIndex !== null ? "تعديل القاعدة" : "إضافة قاعدة جديدة"}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={cancelEdit}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">اسم القاعدة</Label>
              <Input
                placeholder="مثال: تخفيض الكمية الكبيرة"
                value={formData?.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">حقل الشرط</Label>
                <Select
                  value={formData?.condition?.field || "quantity"}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      condition: {
                        field: v as "product_code" | "quantity" | "supplier" | "category" | "season",
                        operator: formData?.condition?.operator || "equals",
                        value: formData?.condition?.value || "",
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">المشغل</Label>
                <Select
                  value={formData?.condition?.operator || "equals"}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      condition: {
                        field: formData?.condition?.field || "quantity",
                        operator: v as "equals" | "greater_than" | "less_than" | "between" | "contains",
                        value: formData?.condition?.value || "",
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">القيمة</Label>
                <Input
                  placeholder="قيمة الشرط"
                  value={
                    Array.isArray(formData?.condition?.value)
                      ? formData.condition.value.join(",")
                      : formData?.condition?.value || ""
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: {
                        field: formData?.condition?.field || "quantity",
                        operator: formData?.condition?.operator || "equals",
                        value: e.target.value,
                      },
                    })
                  }
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">نوع التعديل</Label>
                <Select
                  value={formData?.adjustment?.type || "percentage"}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      adjustment: {
                        type: v as "fixed" | "percentage",
                        value: formData?.adjustment?.value || 0,
                        direction: formData?.adjustment?.direction || "increase",
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">الاتجاه</Label>
                <Select
                  value={formData?.adjustment?.direction || "decrease"}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      adjustment: {
                        type: formData?.adjustment?.type || "fixed",
                        value: formData?.adjustment?.value || 0,
                        direction: v as "increase" | "decrease",
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">زيادة</SelectItem>
                    <SelectItem value="decrease">انخفاض</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">القيمة</Label>
                <Input
                  type="number"
                  value={formData?.adjustment?.value || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adjustment: {
                        type: formData?.adjustment?.type || "fixed",
                        value: parseFloat(e.target.value) || 0,
                        direction: formData?.adjustment?.direction || "increase",
                      },
                    })
                  }
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              إلغاء
            </Button>
            <Button size="sm" onClick={saveRule}>
              <Save className="size-4 mr-1" />
              حفظ القاعدة
            </Button>
          </div>
        </Card>
      ) : (
        <Button
          onClick={() => setFormData({})}
          className="w-full gap-2"
          variant="outline"
        >
          <Plus className="size-4" />
          إضافة قاعدة جديدة
        </Button>
      )}

      {/* Save Button */}
      {onSave && (
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button
            variant="outline"
            disabled={isSaving}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving && <Save className="size-4 animate-spin" />}
            حفظ جميع القواعس
          </Button>
        </div>
      )}
    </div>
  );
}
