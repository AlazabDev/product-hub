import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgentHealth } from "@/lib/agent-health.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RefreshCw, Bot, Wrench, Database, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/agent-settings")({
  head: () => ({ meta: [{ title: "إعدادات وكيل Azure — Alazab" }] }),
  component: AgentSettingsPage,
});

const DEFAULT_PROMPT = `أنت وكيل تنسيق وضبط منتجات شركة العزب. مهامك:
1. البحث عن المنتجات وإرجاع بياناتها.
2. اقتراح تحسينات على التصنيف والبيانات الناقصة.
3. الرد على الاستفسارات الفنية بدقة.
استخدم الأدوات عند الحاجة. أجب بالعربية.`;

interface AgentConfig {
  temperature: number;
  maxTokens: number;
  systemPromptOverride: string;
  enableRag: boolean;
  enableTools: boolean;
}

const STORAGE_KEY = "azure-agent-config";
const DEFAULT_CONFIG: AgentConfig = {
  temperature: 0.3,
  maxTokens: 800,
  systemPromptOverride: "",
  enableRag: true,
  enableTools: true,
};

export function loadAgentConfig(): AgentConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function AgentSettingsPage() {
  const [cfg, setCfg] = useState<AgentConfig>(DEFAULT_CONFIG);
  useEffect(() => setCfg(loadAgentConfig()), []);

  const fn = useServerFn(getAgentHealth);
  const health = useQuery({
    queryKey: ["agent-health"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    toast.success("تم حفظ الإعدادات");
  };
  const reset = () => {
    setCfg(DEFAULT_CONFIG);
    localStorage.removeItem(STORAGE_KEY);
    toast.info("تمت إعادة تعيين الإعدادات");
  };

  const checks = health.data?.checks;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-accent text-accent-foreground grid place-items-center">
          <Bot className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">إعدادات وكيل Azure</h1>
          <p className="text-sm text-muted-foreground">
            تحكم في سلوك وكيل الذكاء الاصطناعي وصحة الاتصال.
          </p>
        </div>
      </div>

      {/* Health */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">مؤشر صحة الاتصال</h2>
            {health.data && (
              <Badge variant={health.data.overall ? "default" : "destructive"}>
                {health.data.overall ? "سليم" : "يوجد مشاكل"}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => health.refetch()}
            disabled={health.isFetching}
          >
            <RefreshCw className={`size-4 ml-1 ${health.isFetching ? "animate-spin" : ""}`} />
            فحص
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <HealthRow icon={Bot} label="Azure OpenAI" check={checks?.openai} />
          <HealthRow icon={Search} label="Azure AI Search" check={checks?.search} />
          <HealthRow icon={Database} label="قاعدة البيانات" check={checks?.db} />
        </div>
      </Card>

      {/* Config */}
      <Card className="p-5 space-y-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Wrench className="size-5" /> إعدادات النموذج
        </h2>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>درجة الإبداع (Temperature)</Label>
            <span className="text-sm font-mono num">{cfg.temperature.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={2}
            step={0.05}
            value={[cfg.temperature]}
            onValueChange={([v]) => setCfg((c) => ({ ...c, temperature: v }))}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>الحد الأقصى للتوكن</Label>
            <span className="text-sm font-mono num">{cfg.maxTokens}</span>
          </div>
          <Slider
            min={128}
            max={4000}
            step={64}
            value={[cfg.maxTokens]}
            onValueChange={([v]) => setCfg((c) => ({ ...c, maxTokens: v }))}
          />
        </div>

        <div className="flex items-center justify-between border rounded-lg p-3">
          <div>
            <Label>تفعيل RAG (البحث المعرفي)</Label>
            <p className="text-xs text-muted-foreground">
              يستخدم Azure AI Search لجلب سياق المنتجات قبل الرد.
            </p>
          </div>
          <Switch
            checked={cfg.enableRag}
            onCheckedChange={(v) => setCfg((c) => ({ ...c, enableRag: v }))}
          />
        </div>

        <div className="flex items-center justify-between border rounded-lg p-3">
          <div>
            <Label>تفعيل الأدوات الاحترافية</Label>
            <p className="text-xs text-muted-foreground">
              يمكّن الوكيل من: بحث المنتجات، جلب التفاصيل بواسطة AZ Code، وإدراج المنتجات الناقصة.
            </p>
          </div>
          <Switch
            checked={cfg.enableTools}
            onCheckedChange={(v) => setCfg((c) => ({ ...c, enableTools: v }))}
          />
        </div>

        <div className="space-y-2">
          <Label>موجه النظام المخصص (اتركه فارغاً للاستخدام الافتراضي)</Label>
          <Textarea
            rows={7}
            placeholder={DEFAULT_PROMPT}
            value={cfg.systemPromptOverride}
            onChange={(e) => setCfg((c) => ({ ...c, systemPromptOverride: e.target.value }))}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={reset}>
            إعادة تعيين
          </Button>
          <Button onClick={save}>حفظ الإعدادات</Button>
        </div>
      </Card>
    </div>
  );
}

function HealthRow({
  icon: Icon,
  label,
  check,
}: {
  icon: any;
  label: string;
  check?: { ok: boolean; latencyMs: number | null; message: string; detail?: string };
}) {
  const ok = check?.ok;
  return (
    <div className="border rounded-lg p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-sm">
          <Icon className="size-4" /> {label}
        </div>
        {check ? (
          ok ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <XCircle className="size-4 text-destructive" />
          )
        ) : (
          <RefreshCw className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="text-xs text-muted-foreground truncate" title={check?.detail}>
        {check?.message ?? "…"}
      </div>
      {check?.latencyMs != null && (
        <div className="text-[10px] text-muted-foreground num" dir="ltr">
          {check.latencyMs} ms
        </div>
      )}
    </div>
  );
}
