// Azure OpenAI + Azure AI Search helpers (server-only)
// Use these from server functions to wire agents/tools into Azure.

const required = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} not configured`);
  return v;
};

export function azureStatus() {
  return {
    openai: {
      endpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: !!process.env.AZURE_OPENAI_API_KEY,
      deployment: !!process.env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: !!process.env.AZURE_OPENAI_API_VERSION,
    },
    search: {
      endpoint: !!process.env.AZURE_SEARCH_ENDPOINT,
      apiKey: !!process.env.AZURE_SEARCH_API_KEY,
      index: !!process.env.AZURE_SEARCH_INDEX,
    },
  };
}

export async function azureChat(
  messages: Array<{ role: string; content: string }>,
  opts: { temperature?: number; maxTokens?: number } = {},
) {
  const endpoint = required("AZURE_OPENAI_ENDPOINT").replace(/\/$/, "");
  const apiKey = required("AZURE_OPENAI_API_KEY");
  const deployment = required("AZURE_OPENAI_DEPLOYMENT");
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });
  if (!res.ok) throw new Error(`Azure OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function azureSearch(query: string, top = 10) {
  const endpoint = required("AZURE_SEARCH_ENDPOINT").replace(/\/$/, "");
  const apiKey = required("AZURE_SEARCH_API_KEY");
  const index = required("AZURE_SEARCH_INDEX");
  const apiVersion = "2024-07-01";

  const url = `${endpoint}/indexes/${index}/docs/search?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ search: query, top, queryType: "simple" }),
  });
  if (!res.ok) throw new Error(`Azure Search ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json())?.value ?? [];
}
