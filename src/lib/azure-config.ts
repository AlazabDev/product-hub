/**
 * Azure Configuration — reads from environment only.
 * Browser uses VITE_* (publishable only); server uses process.env (secrets).
 * NEVER hardcode keys or endpoints here.
 */

const isServer = typeof process !== "undefined" && !!process.env;

function env(name: string, viteName?: string): string {
  if (isServer) {
    const v = process.env[name];
    if (v) return v;
  }
  // Client-safe public values (only those exposed via VITE_*)
  if (viteName && typeof import.meta !== "undefined") {
    const v = (import.meta as { env?: Record<string, string | undefined> }).env?.[viteName];
    if (v) return v;
  }
  return "";
}

export const azureConfig = {
  openai: {
    endpoint: env("AZURE_OPENAI_ENDPOINT"),
    apiKey: env("AZURE_OPENAI_API_KEY"),
    deployment: env("AZURE_OPENAI_DEPLOYMENT"),
    apiVersion: env("AZURE_OPENAI_API_VERSION") || "2024-08-01-preview",
    resourceName: (env("AZURE_OPENAI_ENDPOINT") || "").replace(/^https?:\/\//, "").split(".")[0],
  },
  search: {
    endpoint: env("AZURE_SEARCH_ENDPOINT"),
    apiKey: env("AZURE_SEARCH_API_KEY"),
    index: env("AZURE_SEARCH_INDEX") || "alazab-products",
    semanticConfig: env("AZURE_SEARCH_SEMANTIC_CONFIG") || "default",
    vectorField: env("AZURE_SEARCH_VECTOR_FIELD") || "contentVector",
    contentField: env("AZURE_SEARCH_CONTENT_FIELD") || "content",
    idField: env("AZURE_SEARCH_ID_FIELD") || "id",
  },
  storage: {
    accountName: env("AZURE_STORAGE_ACCOUNT_NAME"),
    connectionString: env("AZURE_STORAGE_CONNECTION_STRING"),
  },
  keyVault: {
    vaultName: env("AZURE_KEY_VAULT_NAME"),
    vaultUri: env("AZURE_KEY_VAULT_URI"),
  },
  apim: {
    serviceName: env("AZURE_APIM_SERVICE_NAME"),
    endpoint: env("AZURE_APIM_ENDPOINT"),
  },
  appInsights: {
    instrumentationKey: env("AZURE_APP_INSIGHTS_KEY"),
  },
  auth: {
    useManagedIdentity: env("AZURE_USE_MANAGED_IDENTITY") === "true",
  },
} as const;

export function azureStatus() {
  return {
    openai: {
      endpoint: !!azureConfig.openai.endpoint,
      apiKey: !!azureConfig.openai.apiKey,
      deployment: !!azureConfig.openai.deployment,
      apiVersion: !!azureConfig.openai.apiVersion,
    },
    search: {
      endpoint: !!azureConfig.search.endpoint,
      apiKey: !!azureConfig.search.apiKey,
      index: !!azureConfig.search.index,
    },
  };
}

export default azureConfig;
