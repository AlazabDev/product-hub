import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Network,
  Plus,
  Check,
  AlertCircle,
  Clock,
  Settings,
  Zap,
  RefreshCw,
  Trash2,
  Eye,
  Code,
} from "lucide-react";
import { toast } from "sonner";

const integrations = [
  {
    id: "daftra",
    name: "Daftra",
    description: "نظام المحاسبة والإدارة",
    status: "ready",
    color: "bg-blue-500/20 text-blue-700",
    icon: "🏢",
    dataFlow: "ثنائي الاتجاه",
    lastSync: "2026-05-22 14:30",
    syncFrequency: "كل 6 ساعات",
    docs: "/docs/INTEGRATIONS#daftra",
  },
  {
    id: "bot-gateway",
    name: "Bot Gateway API",
    description: "واجهة برمجية للدردشة الآلية",
    status: "ready",
    color: "bg-green-500/20 text-green-700",
    icon: "🤖",
    dataFlow: "من AzProud فقط",
    lastSync: "2026-05-22 15:15",
    syncFrequency: "فوري",
    docs: "/docs/INTEGRATIONS#bot-gateway",
  },
  {
    id: "erpnext",
    name: "ERPNext",
    description: "نظام إدارة الموارد",
    status: "planned",
    color: "bg-yellow-500/20 text-yellow-700",
    icon: "📊",
    dataFlow: "ثنائي الاتجاه",
    lastSync: "غير متصل",
    syncFrequency: "تحت التطوير",
    docs: "/docs/INTEGRATIONS#erpnext",
  },
  {
    id: "azure-openai",
    name: "Azure OpenAI",
    description: "خدمة الذكاء الاصطناعي",
    status: "active",
    color: "bg-purple-500/20 text-purple-700",
    icon: "✨",
    dataFlow: "من AzProud فقط",
    lastSync: "2026-05-22 15:45",
    syncFrequency: "حسب الطلب",
    docs: "/docs/INTEGRATIONS#azure-openai",
  },
];

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(
    null
  );
  const [showSettings, setShowSettings] = useState(false);
  const qc = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "sync-integration",
        {
          body: { integrationId },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("تم تشغيل المزامنة بنجاح");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "فشلت المزامنة");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from("integration_configs")
        .delete()
        .eq("id", configId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف التكامل");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل الحذف");
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Network className="size-8 text-accent" />
            التكاملات والتوصيلات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            قم بإدارة وتوصيل AzProud مع الأنظمة الخارجية
          </p>
        </div>
        <Sheet open={showSettings} onOpenChange={setShowSettings}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              تكامل جديد
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>إضافة تكامل جديد</SheetTitle>
              <SheetDescription>
                اختر النظام الذي تريد توصيله مع AzProud
              </SheetDescription>
            </SheetHeader>
            <IntegrationSetupForm
              onSuccess={() => {
                setShowSettings(false);
                qc.invalidateQueries({ queryKey: ["integrations"] });
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {integrations.map((integration) => {
          const config = configs.find((c: any) => c.type === integration.id);
          const isConnected = config?.status === "active";

          return (
            <Card
              key={integration.id}
              className="p-6 surface-elevated border-0 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{integration.icon}</div>
                  <div>
                    <h3 className="font-bold text-lg">{integration.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {integration.description}
                    </p>
                  </div>
                </div>
                <Badge
                  className={`${integration.color} border-0`}
                  variant="secondary"
                >
                  {integration.status === "ready"
                    ? "جاهز"
                    : integration.status === "active"
                      ? "نشط"
                      : "قيد التطوير"}
                </Badge>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">تدفق البيانات:</span>
                  <span className="font-medium">{integration.dataFlow}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">آخر مزامنة:</span>
                  <span className="font-medium">{integration.lastSync}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">تكرار المزامنة:</span>
                  <span className="font-medium">{integration.syncFrequency}</span>
                </div>
              </div>

              {isConnected && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Check className="size-4" />
                    <span>متصل وفعال</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => syncMutation.mutate(integration.id)}
                  disabled={!isConnected || syncMutation.isPending}
                >
                  <RefreshCw className="size-3" />
                  مزامنة
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setSelectedIntegration(integration.id)}
                    >
                      <Code className="size-3" />
                      الإعدادات
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader>
                      <DialogTitle>{integration.name}</DialogTitle>
                      <DialogDescription>
                        إعدادات التكامل والتكوين
                      </DialogDescription>
                    </DialogHeader>
                    <IntegrationDetails
                      integration={integration}
                      config={config}
                    />
                  </DialogContent>
                </Dialog>
                {isConnected && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive gap-1"
                    onClick={() => {
                      if (config?.id) deleteMutation.mutate(config.id);
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Active Integrations List */}
      {configs.length > 0 && (
        <Card className="p-6 surface-elevated border-0">
          <h2 className="text-xl font-bold mb-4">التكاملات النشطة</h2>
          <div className="space-y-3">
            {configs.map((config: any) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
              >
                <div>
                  <p className="font-medium capitalize">{config.type}</p>
                  <p className="text-xs text-muted-foreground">
                    تم إنشاؤه في {new Date(config.created_at).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {config.status === "active" && (
                    <Badge className="bg-green-500/20 text-green-700 border-0">
                      نشط
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(config.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Integration Docs */}
      <Card className="p-6 surface-elevated border-0 bg-accent/5">
        <div className="flex items-start gap-4">
          <Zap className="size-6 text-accent shrink-0 mt-1" />
          <div>
            <h3 className="font-bold mb-2">هل تحتاج إلى مساعدة؟</h3>
            <p className="text-sm text-muted-foreground mb-4">
              راجع دليل التكاملات الشامل لفهم كيفية توصيل كل نظام والتعامل مع الأخطاء.
            </p>
            <Link
              to="/docs/INTEGRATIONS"
              className="text-accent hover:underline font-medium text-sm"
            >
              اقرأ دليل التكاملات الكامل →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

function IntegrationSetupForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [type, setType] = useState("daftra");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("integration_configs").insert({
        type,
        status: "active",
        config: {
          api_key: apiKey,
          api_secret: apiSecret,
          created_at: new Date().toISOString(),
        },
      });

      if (error) throw error;
      toast.success("تم إضافة التكامل بنجاح");
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "فشل إضافة التكامل");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 mt-6">
      <div>
        <Label htmlFor="integration-type">نوع التكامل</Label>
        <select
          id="integration-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background mt-2"
        >
          <option value="daftra">Daftra - نظام المحاسبة</option>
          <option value="bot-gateway">Bot Gateway - الدردشة الآلية</option>
          <option value="erpnext">ERPNext - إدارة الموارد</option>
          <option value="azure-openai">Azure OpenAI - الذكاء الاصطناعي</option>
        </select>
      </div>

      <div>
        <Label htmlFor="api-key">مفتاح API</Label>
        <Input
          id="api-key"
          type="password"
          placeholder="أدخل مفتاح API"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="api-secret">API Secret (اختياري)</Label>
        <Input
          id="api-secret"
          type="password"
          placeholder="أدخل السر"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          className="mt-2"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!apiKey || isLoading}
        className="w-full"
      >
        {isLoading ? "جاري الحفظ..." : "إضافة التكامل"}
      </Button>
    </div>
  );
}

function IntegrationDetails({
  integration,
  config,
}: {
  integration: (typeof integrations)[0];
  config: any;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="bg-secondary/50 rounded-lg p-4 space-y-2 text-sm">
        <div>
          <p className="text-muted-foreground">الحالة:</p>
          <Badge className="bg-green-500/20 text-green-700 border-0 mt-1">
            {config?.status === "active" ? "متصل" : "غير متصل"}
          </Badge>
        </div>

        <div>
          <p className="text-muted-foreground">تدفق البيانات:</p>
          <p className="font-medium mt-1">{integration.dataFlow}</p>
        </div>

        <div>
          <p className="text-muted-foreground">آخر تحديث:</p>
          <p className="font-medium mt-1">{integration.lastSync}</p>
        </div>

        {config?.config?.created_at && (
          <div>
            <p className="text-muted-foreground">تم الاتصال في:</p>
            <p className="font-medium mt-1">
              {new Date(config.config.created_at).toLocaleString("ar-SA")}
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t space-y-2 text-sm">
        <p className="text-muted-foreground">الحقول المتزامنة:</p>
        <ul className="space-y-1 text-xs">
          {integration.id === "daftra" && (
            <>
              <li>✓ المنتجات والخدمات</li>
              <li>✓ قوائم الأسعار</li>
              <li>✓ الفواتير والطلبات</li>
            </>
          )}
          {integration.id === "bot-gateway" && (
            <>
              <li>✓ كتالوج المنتجات</li>
              <li>✓ توفر الأصناف</li>
              <li>✓ أسعار البيع</li>
            </>
          )}
          {integration.id === "azure-openai" && (
            <>
              <li>✓ تحليل المنتجات</li>
              <li>✓ توليد الأوصاف</li>
              <li>✓ ترجمة النصوص</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
