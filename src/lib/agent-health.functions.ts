import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CheckResult = {
  ok: boolean;
  latencyMs: number | null;
  message: string;
  detail?: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = Date.now();
  const r = await fn();
  return [r, Date.now() - t];
}

async function checkOpenAI(): Promise<CheckResult> {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/$/, "");
  const key = process.env.AZURE_OPENAI_API_KEY ?? "";
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";
  if (!endpoint || !key || !deployment) {
    return { ok: false, latencyMs: null, message: "أسرار Azure OpenAI ناقصة." };
  }
  try {
    const [res, ms] = await timed(() =>
      fetch(
        `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": key },
          body: JSON.stringify({
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        },
      ),
    );
    if (!res.ok) {
      return {
        ok: false,
        latencyMs: ms,
        message: `فشل الاتصال (${res.status})`,
        detail: (await res.text()).slice(0, 200),
      };
    }
    return { ok: true, latencyMs: ms, message: `متصل • النشر: ${deployment}` };
  } catch (e: any) {
    return { ok: false, latencyMs: null, message: "خطأ شبكة", detail: e.message };
  }
}

async function checkSearch(): Promise<CheckResult> {
  const endpoint = (process.env.AZURE_SEARCH_ENDPOINT ?? "").replace(/\/$/, "");
  const key = process.env.AZURE_SEARCH_API_KEY ?? "";
  const index = process.env.AZURE_SEARCH_INDEX ?? "";
  if (!endpoint || !key || !index) {
    return { ok: false, latencyMs: null, message: "أسرار Azure Search ناقصة." };
  }
  try {
    const [res, ms] = await timed(() =>
      fetch(`${endpoint}/indexes/${index}/docs/$count?api-version=2024-07-01`, {
        headers: { "api-key": key },
      }),
    );
    if (!res.ok) {
      return {
        ok: false,
        latencyMs: ms,
        message: `فشل (${res.status})`,
        detail: (await res.text()).slice(0, 200),
      };
    }
    const count = await res.text();
    return { ok: true, latencyMs: ms, message: `فهرس ${index} • ${count.trim()} وثيقة` };
  } catch (e: any) {
    return { ok: false, latencyMs: null, message: "خطأ شبكة", detail: e.message };
  }
}

export const getAgentHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [openai, search] = await Promise.all([checkOpenAI(), checkSearch()]);

    let db: CheckResult;
    try {
      const [res, ms] = await timed(async () =>
        await context.supabase.from("products").select("id", { count: "exact", head: true }),
      );
      const error = (res as { error: { message: string } | null }).error;
      db = error
        ? { ok: false, latencyMs: ms, message: "فشل الاستعلام", detail: error.message }
        : { ok: true, latencyMs: ms, message: "قاعدة البيانات متصلة" };
    } catch (e: any) {
      db = { ok: false, latencyMs: null, message: "خطأ", detail: e.message };
    }

    const overall = openai.ok && search.ok && db.ok;
    return { overall, checks: { openai, search, db }, checkedAt: new Date().toISOString() };
  });
