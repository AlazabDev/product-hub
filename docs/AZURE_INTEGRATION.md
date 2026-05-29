# Azure Automatic Integration Guide

## Overview

This guide covers automatic Azure resource discovery and integration for AzProud. The system automatically detects and configures all Azure resources in your environment.

## Supported Azure Resources

### Primary Resources (auto-configured)
- **Azure OpenAI** - LLM inference and embeddings
- **Azure Storage** - Blob storage for documents and images
- **Azure Key Vault** - Secure credential management
- **Azure API Management** - API gateway and rate limiting
- **Azure Application Insights** - Monitoring and diagnostics

### Secondary Resources (available for integration)
- **Azure Cognitive Search** - Full-text search capabilities
- **Azure SQL Database** - Relational data storage
- **Azure PostgreSQL** - Vector and JSON data support
- **Azure Cosmos DB** - NoSQL and document storage
- **Azure Container Apps** - Containerized workloads
- **Azure Machine Learning** - Model training and inference
- **Azure Log Analytics** - Centralized logging

## Quick Setup (5 minutes)

### Step 1: Prerequisites
```bash
# Install Azure CLI
# macOS
brew install azure-cli

# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Windows
# Download from https://aka.ms/azure-cli
```

### Step 2: Azure Login
```bash
az login
# This opens browser for authentication

# Verify subscription
az account show
```

### Step 3: Run Auto Setup
```bash
# Make script executable
chmod +x scripts/azure-auto-setup.sh

# Run auto-discovery and configuration
./scripts/azure-auto-setup.sh
```

### Step 4: Verify Configuration
```bash
# Check generated files
ls -la .env.production.azure
ls -la src/lib/azure-config.ts

# Review configuration
cat .env.production.azure
```

### Step 5: Deploy
```bash
# Update main environment
cp .env.production.example .env.production
# Edit and add sensitive values from .env.production.azure

# Build and deploy
npm run build
./scripts/azure-deploy.sh
```

## Auto Setup Script Details

### What the script does:

1. **Validates Prerequisites**
   - Checks Azure CLI installation
   - Verifies jq for JSON parsing
   - Confirms authentication

2. **Discovers Resources**
   - Scans all resource groups
   - Finds all Azure resources
   - Identifies service endpoints

3. **Extracts Configuration**
   - Azure OpenAI credentials and endpoints
   - Storage account connection strings
   - Key Vault URIs and credentials
   - APIM service details
   - App Insights instrumentation keys

4. **Generates Files**
   - `.env.production.azure` - Environment variables
   - `src/lib/azure-config.ts` - TypeScript configuration
   - `scripts/azure-deploy.sh` - Deployment script

5. **Installs Dependencies**
   - Azure SDK packages
   - Storage clients
   - Identity libraries
   - Monitoring clients

## Environment Variables

All discovered resources are stored in `.env.production.azure`:

```bash
# Azure Subscription
AZURE_SUBSCRIPTION_ID=1363114a-a1d7-4abb-8042-dcdebf91e2c9
AZURE_TENANT_ID=54f7523b-7bc4-438e-83d5-e45e17302fd4

# Azure OpenAI
AZURE_OPENAI_API_KEY=***
AZURE_OPENAI_ENDPOINT=https://azab-openai.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=azabstorage4718
AZURE_STORAGE_ACCOUNT_KEY=***
AZURE_STORAGE_CONNECTION_STRING=***

# Azure Key Vault
AZURE_KEYVAULT_VAULT_NAME=azab-kv-core
AZURE_KEYVAULT_VAULT_URI=https://azab-kv-core.vault.azure.net/

# Azure APIM
AZURE_APIM_SERVICE_NAME=azab-apim
AZURE_APIM_ENDPOINT=https://azab-apim.azure-api.net/

# Application Insights
AZURE_APPINSIGHTS_INSTRUMENTATION_KEY=***
```

## Azure Configuration Object

The `src/lib/azure-config.ts` file provides typed access to Azure configuration:

```typescript
import { azureConfig } from '@/lib/azure-config';

// Access OpenAI configuration
const { endpoint, apiKey, deployment } = azureConfig.openai;

// Access Storage configuration
const { connectionString } = azureConfig.storage;

// Access Key Vault configuration
const { vaultUri } = azureConfig.keyVault;
```

## Integration in Application Code

### Using Azure OpenAI

```typescript
import { getOpenAIClient } from '@/lib/azure-config';

const client = getOpenAIClient();
const response = await client.getCompletions(deployment, prompt, {
  maxTokens: 1000,
});
```

### Using Azure Storage

```typescript
import { getStorageClient } from '@/lib/azure-config';

const blobServiceClient = getStorageClient();
const containerClient = blobServiceClient.getContainerClient('documents');

// Upload file
await containerClient.uploadBlockBlob(filename, data);

// Download file
const downloadBlockBlobResponse = await blockBlobClient.download(0);
```

### Using Key Vault Secrets

```typescript
import { getSecretFromKeyVault } from '@/lib/azure-config';

// Retrieve secret
const apiKey = await getSecretFromKeyVault('api-key');
const connectionString = await getSecretFromKeyVault('db-connection');
```

## Monitoring and Logging

### Application Insights

The system automatically logs to Application Insights:

```typescript
import { initializeApplicationInsights } from '@/lib/monitoring';

initializeApplicationInsights({
  instrumentationKey: azureConfig.appInsights.instrumentationKey,
  enableConsoleLogging: true,
});
```

### Log Analytics

View logs in Azure Portal:

```
Resource: azab-loganalytics (Log Analytics workspace)
Query: Traces | where timestamp > ago(1h)
```

## Security Best Practices

### 1. Credential Management
- Store sensitive values in Azure Key Vault
- Never commit `.env.production.azure` to version control
- Use Managed Identities when possible
- Rotate keys regularly

### 2. Network Security
- Use private endpoints for services
- Configure Network Security Groups
- Enable firewall rules
- Use VPN for admin access

### 3. Access Control
- Use RBAC for user permissions
- Implement Managed Identities
- Enable audit logging
- Review access regularly

### 4. Encryption
- Enable encryption at rest
- Use TLS 1.2+ for transport
- Encrypt sensitive data fields
- Manage encryption keys in Key Vault

## Troubleshooting

### Issue: Azure CLI not found
```bash
# Install Azure CLI
brew install azure-cli  # macOS
# or download from https://aka.ms/azure-cli
```

### Issue: Authentication fails
```bash
# Clear cached tokens
az account clear

# Login again
az login
```

### Issue: Cannot access Key Vault
```bash
# Check permissions
az keyvault show --name azab-kv-core

# Add yourself as reader
az keyvault set-policy --name azab-kv-core --object-id $(az ad signed-in-user show --query id -o tsv) --secret-permissions get list
```

### Issue: Storage connection fails
```bash
# Verify storage account exists
az storage account show --name azabstorage4718

# Get new connection string
az storage account show-connection-string --name azabstorage4718
```

## Azure Resources Reference

Your Azure subscription contains:

### Subscription Details
- **Subscription:** Microsoft Azure Sponsorship
- **Subscription ID:** 1363114a-a1d7-4abb-8042-dcdebf91e2c9
- **Tenant ID:** 54f7523b-7bc4-438e-83d5-e45e17302fd4
- **Default Region:** West Europe

### Resource Groups
- `azab-rg-core` - Core infrastructure (VMs, storage, networking)
- `azab-rg-ai` - AI/ML resources (OpenAI, Search, ML)
- `azab-rg-integration` - Integration services (APIM, Functions)

### Key Resources

**AI & Cognition**
- `azab-openai` - Azure OpenAI Service
- `azab-cognitivesearch` - Cognitive Search
- `aicu-azabinstitutionalx7pqk` - Azure OpenAI (Speech)
- `aif-azabinstitutionalx7pqk` - Azure OpenAI (Vision)
- `azab-ml-workspace` - Machine Learning Workspace

**Data & Storage**
- `azabstorage4718` - Blob Storage (primary)
- `stazabinstitutionalx7pqk` - Storage Account
- `cosmos-azabinstitutionalx7pqk` - Cosmos DB
- `azab-knowledge-pg` - PostgreSQL Database
- `alazab-pc` - SQL Server (Arc)

**Integration & API**
- `azab-apim` - API Management
- `azab-actions` - Azure Functions
- `azabai` - APIM (AI)

**Security & Management**
- `azab-kv-core` - Key Vault (primary)
- `server-core` - Key Vault (secondary)
- `azabmlwokeyvaultbdeae91b` - ML Key Vault

**Monitoring**
- `azab-appinsights` - Application Insights
- `azab-loganalytics` - Log Analytics
- `managed-azab-appinsights-ws` - Managed Log Analytics

**Compute & Networking**
- `azab-orchestrator` - Virtual Machine
- `azab-orchestratorVNET` - Virtual Network
- `azab-orchestratorNSG` - Network Security Group

**Container Services**
- `crazabinstitutionalx7pqk` - Container Registry
- `cae-azabinstitutionalx7pqk` - Container Apps Environment
- `ca-azabinstitutionalx7pqk-*` - Container Apps (4 instances)

## Maintenance

### Daily Tasks
```bash
# Monitor Application Insights
az monitor app-insights component show-analytics --app-id azab-appinsights

# Check resource health
az resource list --query "[?resourceGroup=='azab-rg-core'].{Name:name,Status:provisioningState}"
```

### Weekly Tasks
```bash
# Backup databases
az sql db backup create --server alazab-pc --database master

# Review logs
az monitor log-analytics workspace query --workspace-id azab-loganalytics
```

### Monthly Tasks
```bash
# Rotate secrets
az keyvault secret set --vault-name azab-kv-core --name api-key --value <new-key>

# Review costs
az consumption budget list --query "[].{Name:name,Limit:amount}"

# Update dependencies
npm update
```

## Support

For issues or questions:
1. Check Azure Portal: https://portal.azure.com
2. Review logs in Application Insights
3. Check Log Analytics workspace
4. Contact Azure Support if needed

## Additional Resources

- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/)
- [Azure Storage Documentation](https://learn.microsoft.com/en-us/azure/storage/)
- [Azure Key Vault Documentation](https://learn.microsoft.com/en-us/azure/key-vault/)
- [Azure SDK for JavaScript](https://github.com/Azure/azure-sdk-for-js)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure)
