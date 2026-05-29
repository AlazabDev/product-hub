import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Lightbulb,
  RefreshCw,
  Search,
  Wrench,
  ArrowRight,
} from "lucide-react";
import snapshot from "@/data/build-health.json";

type Issue = {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  category: string;
  severity: "error" | "warning";
  suggestion: string;
};

type Snapshot = {
  generatedAt: string;
  totalErrors: number;
  totalWarnings: number;
  byCategory: Record<string, number>;
  byFile: Record<string, number>;
  issues: Issue[];
};

const data = snapshot as Snapshot;

export const Route = createFileRoute("/_authenticated/build-health")({
  head: () => ({ meta: [{ title: "Build Health — Alazab PAOP" }] }),
  component: BuildHealthPage,
});

const SEV_COLORS: Record<string, string> = {
  error: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning border-warning/30",
};

function BuildHealthPage() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.issues.filter((i) => {
      if (activeCat && i.category !== activeCat) return false;
      if (!q) return true;
      return (
        i.file.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        i.message.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    });
  }, [query, activeCat]);

  const groupedByFile = useMemo(() => {
    const g: Record<string, Issue[]> = {};
    for (const it of filtered) {
      (g[it.file] ||= []).push(it);
    }
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const generated = new Date(data.generatedAt);
  const isHealthy = data.totalErrors === 0;

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="size-6 text-accent" /> Build Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            قائمة أخطاء البناء (tsc --noEmit) مع تصنيف واقتراح إصلاح لكل مشكلة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowRight className="size-3" /> لوحة التحكم
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="surface-elevated border-0">
          <CardContent className="p-4 flex items-center gap-3">
            {isHealthy ? (
              <CheckCircle2 className="size-8 text-success" />
            ) : (
              <AlertTriangle className="size-8 text-destructive" />
            )}
            <div>
              <div className="text-2xl font-bold num" dir="ltr">
                {data.totalErrors}
              </div>
              <div className="text-xs text-muted-foreground">أخطاء</div>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-elevated border-0">
          <CardContent className="p-4 flex items-center gap-3">
            <FileWarning className="size-8 text-warning" />
            <div>
              <div className="text-2xl font-bold num" dir="ltr">
                {Object.keys(data.byFile).length}
              </div>
              <div className="text-xs text-muted-foreground">ملفات متأثرة</div>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-elevated border-0">
          <CardContent className="p-4 flex items-center gap-3">
            <Lightbulb className="size-8 text-accent" />
            <div>
              <div className="text-2xl font-bold num" dir="ltr">
                {Object.keys(data.byCategory).length}
              </div>
              <div className="text-xs text-muted-foreground">تصنيفات</div>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-elevated border-0">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">آخر فحص</div>
            <div className="text-sm font-semibold num mt-1" dir="ltr">
              {generated.toLocaleString("en-GB")}
            </div>
            <code className="text-[10px] text-muted-foreground mt-1 block" dir="ltr">
              bun scripts/build-health.ts
            </code>
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      <Card className="surface-elevated border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">التصنيفات</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeCat === null ? "default" : "outline"}
            onClick={() => setActiveCat(null)}
            className="h-7 text-xs"
          >
            الكل{" "}
            <span className="num mr-1" dir="ltr">
              ({data.issues.length})
            </span>
          </Button>
          {Object.entries(data.byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, n]) => (
              <Button
                key={cat}
                size="sm"
                variant={activeCat === cat ? "default" : "outline"}
                onClick={() => setActiveCat(cat === activeCat ? null : cat)}
                className="h-7 text-xs"
              >
                {cat}{" "}
                <span className="num mr-1" dir="ltr">
                  ({n})
                </span>
              </Button>
            ))}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          dir="ltr"
          placeholder="filter by file, code, or message…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* Issues grouped by file */}
      {isHealthy ? (
        <Card className="p-12 text-center surface-elevated border-0">
          <CheckCircle2 className="size-12 text-success mx-auto mb-3" />
          <div className="text-lg font-semibold">المشروع نظيف — لا توجد أخطاء بناء ✓</div>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {groupedByFile.map(([file, items]) => (
            <AccordionItem
              key={file}
              value={file}
              className="border rounded-lg surface-elevated px-3"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 flex-1 text-right">
                  <Badge variant="outline" className="num shrink-0" dir="ltr">
                    {items.length}
                  </Badge>
                  <code className="text-xs truncate flex-1 text-right" dir="ltr">
                    {file}
                  </code>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2 pb-3">
                {items.map((it, idx) => (
                  <div
                    key={`${it.line}-${it.column}-${idx}`}
                    className="rounded-md border bg-background p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={SEV_COLORS[it.severity] || ""} variant="outline">
                        {it.code}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {it.category}
                      </Badge>
                      <code className="text-[11px] text-muted-foreground num" dir="ltr">
                        L{it.line}:C{it.column}
                      </code>
                    </div>
                    <p className="text-xs leading-relaxed" dir="ltr">
                      {it.message}
                    </p>
                    <div className="flex items-start gap-2 rounded bg-accent/5 border border-accent/20 p-2">
                      <Lightbulb className="size-4 text-accent shrink-0 mt-0.5" />
                      <div className="text-xs leading-relaxed">
                        <span className="font-semibold text-accent">اقتراح الإصلاح: </span>
                        {it.suggestion}
                      </div>
                    </div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Card className="surface-elevated border-0">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <RefreshCw className="size-3" /> تحديث اللقطة
          </div>
          <p>هذه اللقطة ثابتة وتُجدَّد بتشغيل السكربت محلياً قبل النشر:</p>
          <code className="block bg-muted p-2 rounded num text-[11px]" dir="ltr">
            bun scripts/build-health.ts
          </code>
          <p>
            تُكتب النتائج إلى{" "}
            <code className="num" dir="ltr">
              src/data/build-health.json
            </code>{" "}
            وتُعرض هنا تلقائياً.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
