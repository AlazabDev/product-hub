// Azure Integrations Configuration
// Integrated with discovered Azure resources from az-product environment

import { azureConfig } from "./azure-config";

export type AzureConfigValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>
  | Array<Record<string, unknown>>;

export interface AzureIntegration {
  name: string;
  status: "connected" | "error" | "pending";
  endpoint?: string;
  lastSyncTime?: Date;
  syncInterval?: number;
  config: Record<string, AzureConfigValue>;
}

export const azureIntegrations: Record<string, AzureIntegration> = {
  // Azure OpenAI Integration
  openai: {
    name: "Azure OpenAI",
    status: azureConfig.openai.apiKey ? "connected" : "pending",
    endpoint: azureConfig.openai.endpoint,
    syncInterval: 0, // Real-time
    config: {
      resourceName: azureConfig.openai.resourceName,
      deployment: azureConfig.openai.deployment,
      apiVersion: azureConfig.openai.apiVersion,
      location: "westeurope",
      capabilities: ["text-generation", "embeddings", "vision"],
    },
  },

  // Azure Storage Blob Integration
  storage: {
    name: "Azure Storage",
    status: azureConfig.storage.connectionString ? "connected" : "pending",
    syncInterval: 3600000, // 1 hour
    config: {
      accountName: azureConfig.storage.accountName,
      containers: ["documents", "images", "backups", "exports"],
      accessTier: "Hot",
      replication: "GRS", // Geo-redundant storage
      features: ["blob-storage", "file-shares", "queues", "tables"],
    },
  },

  // Azure Key Vault Integration
  keyVault: {
    name: "Azure Key Vault",
    status: azureConfig.keyVault.vaultUri ? "connected" : "pending",
    endpoint: azureConfig.keyVault.vaultUri,
    syncInterval: 300000, // 5 minutes
    config: {
      vaultName: azureConfig.keyVault.vaultName,
      softDeleteRetentionDays: 90,
      enablePurgeProtection: true,
      useManagedIdentity: azureConfig.auth.useManagedIdentity,
      features: ["secrets", "keys", "certificates"],
    },
  },

  // Azure API Management Integration
  apim: {
    name: "Azure API Management",
    status: azureConfig.apim.endpoint ? "connected" : "pending",
    endpoint: azureConfig.apim.endpoint,
    syncInterval: 600000, // 10 minutes
    config: {
      serviceName: azureConfig.apim.serviceName,
      tier: "Standard",
      location: "westeurope",
      features: ["api-gateway", "rate-limiting", "logging", "monitoring"],
      apis: [
        {
          name: "AzProud API",
          path: "/api",
          version: "v1",
          versioningScheme: "Header",
        },
      ],
    },
  },

  // Azure Application Insights Integration
  appInsights: {
    name: "Application Insights",
    status: azureConfig.appInsights.instrumentationKey ? "connected" : "pending",
    syncInterval: 60000, // 1 minute
    config: {
      instrumentationKey: azureConfig.appInsights.instrumentationKey,
      location: "westeurope",
      samplingPercentage: 100,
      features: ["performance-monitoring", "error-tracking", "availability", "custom-metrics"],
      alertThresholds: {
        errorRatePercentage: 5,
        responseTimeMs: 2000,
        availabilityPercentage: 99.5,
      },
    },
  },

  // Azure Cognitive Search Integration
  cognitiveSearch: {
    name: "Azure Cognitive Search",
    status: "pending",
    syncInterval: 1800000, // 30 minutes
    config: {
      serviceName: "azab-cognitivesearch",
      tier: "Standard",
      location: "westeurope",
      features: ["full-text-search", "faceted-search", "filter", "sort"],
      indexes: ["products", "suppliers", "documents"],
    },
  },

  // Azure SQL Database Integration
  sqlDatabase: {
    name: "Azure SQL Database",
    status: "pending",
    syncInterval: 900000, // 15 minutes
    config: {
      serverName: "alazab-pc",
      databases: ["master", "msdb", "model", "tempdb"],
      backupRetentionDays: 7,
      geoReplication: true,
      features: ["backup", "restore", "geo-replication", "threat-detection"],
    },
  },

  // Azure PostgreSQL Integration
  postgreSQL: {
    name: "Azure Database for PostgreSQL",
    status: "pending",
    syncInterval: 900000, // 15 minutes
    config: {
      serverName: "azab-knowledge-pg",
      location: "northeurope",
      version: "14",
      sku: "Standard_D2s_v3",
      backupRetentionDays: 35,
      geoReplication: true,
      features: ["backup", "restore", "pgvector", "json", "full-text-search"],
    },
  },

  // Azure Cosmos DB Integration
  cosmosDb: {
    name: "Azure Cosmos DB",
    status: "pending",
    syncInterval: 600000, // 10 minutes
    config: {
      accountName: "cosmos-azabinstitutionalx7pqk",
      location: "northeurope",
      defaultConsistency: "Session",
      features: ["multi-region-writes", "document-db", "graph-db", "table-api"],
      databases: ["azproud", "analytics", "cache"],
    },
  },

  // Azure Container Registry Integration
  containerRegistry: {
    name: "Azure Container Registry",
    status: "pending",
    syncInterval: 600000, // 10 minutes
    config: {
      registryName: "crazabinstitutionalx7pqk",
      location: "northeurope",
      tier: "Standard",
      features: ["image-storage", "webhooks", "tasks", "scanning"],
      repositories: ["azproud", "azproud-worker", "azproud-api"],
    },
  },

  // Azure Container Apps Integration
  containerApps: {
    name: "Azure Container Apps",
    status: "pending",
    syncInterval: 300000, // 5 minutes
    config: {
      environment: "cae-azabinstitutionalx7pqk",
      location: "northeurope",
      apps: [
        { name: "ca-azabinstitutionalx7pqk-api", type: "api" },
        { name: "ca-azabinstitutionalx7pqk-wkfl", type: "workflow" },
        { name: "ca-azabinstitutionalx7pqk-app", type: "application" },
        { name: "ca-azabinstitutionalx7pqk-web", type: "web" },
      ],
      features: ["auto-scaling", "networking", "monitoring", "secrets"],
    },
  },

  // Azure Machine Learning Integration
  machineLearning: {
    name: "Azure Machine Learning",
    status: "pending",
    syncInterval: 1800000, // 30 minutes
    config: {
      workspaceName: "azab-ml-workspace",
      location: "northeurope",
      features: ["training", "inference", "pipelines", "monitoring"],
      deployments: [
        { name: "product-classifier", type: "endpoint" },
        { name: "price-predictor", type: "endpoint" },
      ],
    },
  },

  // Azure Log Analytics Integration
  logAnalytics: {
    name: "Azure Log Analytics",
    status: "pending",
    syncInterval: 60000, // 1 minute
    config: {
      workspaceName: "azab-loganalytics",
      location: "westeurope",
      dataRetentionInDays: 30,
      features: ["querying", "monitoring", "alerting", "custom-metrics"],
    },
  },
};

// Helper function to get integration status
export function getIntegrationStatus(
  integrationName: keyof typeof azureIntegrations,
): AzureIntegration | null {
  return azureIntegrations[integrationName] || null;
}

// Helper function to list all active integrations
export function getActiveIntegrations(): AzureIntegration[] {
  return Object.values(azureIntegrations).filter(
    (integration) => integration.status === "connected",
  );
}

// Helper function to list all pending integrations
export function getPendingIntegrations(): AzureIntegration[] {
  return Object.values(azureIntegrations).filter((integration) => integration.status === "pending");
}

// Initialize integrations based on available configuration
export async function initializeAzureIntegrations() {
  const activeIntegrations = getActiveIntegrations();
  const pendingIntegrations = getPendingIntegrations();

  console.log(`[Azure] Initialized ${activeIntegrations.length} active integrations`);
  console.log(`[Azure] ${pendingIntegrations.length} integrations pending configuration`);

  // Update last sync times
  for (const integration of activeIntegrations) {
    integration.lastSyncTime = new Date();
  }

  return {
    active: activeIntegrations.length,
    pending: pendingIntegrations.length,
    total: Object.keys(azureIntegrations).length,
  };
}

export default azureIntegrations;
