/**
 * Build Health snapshot generator.
 *
 * Runs `tsc --noEmit`, parses errors, attaches a fix suggestion to each one
 * based on the error code + message pattern, and writes a JSON snapshot to
 * src/data/build-health.json which the /build-health screen reads.
 *
 * Usage: bun run scripts/build-health.ts
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

const ROOT = resolve(import.meta.dir, "..");
const OUT = resolve(ROOT, "src/data/build-health.json");

function suggest(code: string, message: string, file: string): { category: string; suggestion: string } {
  const m = message;

  if (code === "TS2307") {
    const mod = m.match(/Cannot find module '([^']+)'/)?.[1];
    return {
      category: "وحدة مفقودة",
      suggestion: mod?.startsWith(".")
        ? `أنشئ الملف ${mod} المُشار إليه من ${file}، أو احذف الاستيراد إن كان الكود غير مستخدم.`
        : `ثبّت الحزمة عبر: bun add ${mod}`,
    };
  }

  if (code === "TS2769" || code === "TS2345") {
    const tbl = m.match(/Argument of type '"([^"]+)"' is not assignable/)?.[1];
    if (tbl) {
      return {
        category: "جدول غير موجود في Schema",
        suggestion: `الجدول "${tbl}" غير معرّف في src/integrations/supabase/types.ts. أنشئ هجرة migration لإضافة الجدول أو احذف الكود المرجعي القديم في ${file}.`,
      };
    }
    return {
      category: "عدم تطابق الأنواع",
      suggestion: `راجع توقيع الدالة في ${file}:${m.slice(0, 80)}…`,
    };
  }

  if (code === "TS2339") {
    const prop = m.match(/Property '([^']+)' does not exist/)?.[1];
    return {
      category: "حقل غير موجود",
      suggestion: `الحقل "${prop}" غير موجود في النوع المُستنتج. تحقق من schema الجدول، أو استخدم narrowing/cast إن كانت العلاقة polymorphic.`,
    };
  }

  if (code === "TS2820") {
    const route = m.match(/Type '"([^"]+)"' is not assignable/)?.[1];
    return {
      category: "مسار route غير موجود",
      suggestion: `المسار "${route}" غير معرّف في routeTree. أنشئ ملف src/routes${route}.tsx أو غيّر to= لمسار صحيح.`,
    };
  }

  if (code === "TS2322") {
    return {
      category: "تحويل قيمة غير صالح",
      suggestion: `قيمة من نوع غير مدعوم. مرّر القيمة كـ string (JSON.stringify) أو غيّر نوع العمود في الـ schema.`,
    };
  }

  if (code === "TS6133") {
    return {
      category: "متغير غير مستخدم",
      suggestion: `احذف المتغير أو ابدأه بشرطة سفلية _.`,
    };
  }

  return {
    category: "خطأ TypeScript",
    suggestion: `راجع الرسالة وعدّل الكود وفقاً لها.`,
  };
}

function main() {
  console.log("Running tsc --noEmit …");
  const res = spawnSync("bunx", ["tsc", "--noEmit"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  const out = (res.stdout || "") + (res.stderr || "");

  const issues: Issue[] = [];
  const lineRe = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;
  let current: Issue | null = null;

  const finalize = (it: Issue) => {
    const { category, suggestion } = suggest(it.code, it.message, it.file);
    it.category = category;
    it.suggestion = suggestion;
    issues.push(it);
  };

  for (const raw of out.split(/\r?\n/)) {
    const match = raw.match(lineRe);
    if (match) {
      if (current) finalize(current);
      const [, file, line, col, sev, code, msg] = match;
      current = {
        file,
        line: Number(line),
        column: Number(col),
        code,
        message: msg,
        category: "",
        severity: sev as "error" | "warning",
        suggestion: "",
      };
    } else if (current && raw.trim()) {
      if (current.message.length < 800) {
        current.message += " " + raw.trim();
      }
    }
  }
  if (current) finalize(current);

  // group counts by category
  const byCategory: Record<string, number> = {};
  const byFile: Record<string, number> = {};
  for (const i of issues) {
    byCategory[i.category] = (byCategory[i.category] || 0) + 1;
    byFile[i.file] = (byFile[i.file] || 0) + 1;
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    totalErrors: issues.filter((i) => i.severity === "error").length,
    totalWarnings: issues.filter((i) => i.severity === "warning").length,
    byCategory,
    byFile,
    issues,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
  console.log(`✓ Wrote ${OUT} — ${issues.length} issues`);
}

main();
