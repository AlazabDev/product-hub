#!/bin/bash

#################################################################
# AzProud - Azure Automatic Integration Setup Script
# Automatically discovers and configures Azure resources
# Works with: OpenAI, Storage, APIM, Key Vault, App Insights
#################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Install from: https://aka.ms/azure-cli"
        exit 1
    fi
    log_success "Azure CLI found: $(az --version | head -1)"
    
    # Check jq for JSON parsing
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. Installing..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
        elif command -v brew &> /dev/null; then
            brew install jq
        else
            log_error "Cannot install jq. Please install manually."
            exit 1
        fi
    fi
    log_success "jq found: $(jq --version)"
}

# Check Azure login status
check_azure_login() {
    log_section "Checking Azure Login Status"
    
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure"
        log_info "Please run: az login"
        exit 1
    fi
    
    ACCOUNT=$(az account show --query "{Subscription:name,TenantId:tenantId,User:user.name}")
    log_success "Logged in:"
    echo "$ACCOUNT" | jq '.'
}

# Discover Azure resources
discover_resources() {
    log_section "Discovering Azure Resources"
    
    # Set subscription context
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    TENANT_ID=$(az account show --query tenantId -o tsv)
    
    log_info "Subscription ID: $SUBSCRIPTION_ID"
    log_info "Tenant ID: $TENANT_ID"
    
    # Find resource groups
    log_info "Searching for resource groups with 'azab' in name..."
    RESOURCE_GROUPS=$(az group list --query "[?contains(name, 'azab')].name" -o tsv)
    
    if [ -z "$RESOURCE_GROUPS" ]; then
        log_warning "No resource groups with 'azab' found. Listing all groups:"
        az group list --query "[].name" -o tsv
        return
    fi
    
    log_success "Found resource groups:"
    echo "$RESOURCE_GROUPS"
    
    # Store for later use
    export RESOURCE_GROUPS
}

# Get Azure OpenAI configuration
get_openai_config() {
    log_section "Configuring Azure OpenAI"
    
    # Find OpenAI resource
    OPENAI_RESOURCE=$(az resource list \
        --query "[?type=='Microsoft.CognitiveServices/accounts' && contains(name, 'openai')] | [0]" \
        -o json)
    
    if [ "$OPENAI_RESOURCE" == "null" ] || [ -z "$OPENAI_RESOURCE" ]; then
        log_warning "No Azure OpenAI resource found"
        return
    fi
    
    OPENAI_NAME=$(echo "$OPENAI_RESOURCE" | jq -r '.name')
    OPENAI_RG=$(echo "$OPENAI_RESOURCE" | jq -r '.resourceGroup')
    OPENAI_LOCATION=$(echo "$OPENAI_RESOURCE" | jq -r '.location')
    
    log_success "Found Azure OpenAI: $OPENAI_NAME"
    log_info "Resource Group: $OPENAI_RG"
    log_info "Location: $OPENAI_LOCATION"
    
    # Get API endpoint
    OPENAI_ENDPOINT=$(az cognitiveservices account show \
        --name "$OPENAI_NAME" \
        --resource-group "$OPENAI_RG" \
        --query properties.endpoint -o tsv)
    
    log_success "Endpoint: $OPENAI_ENDPOINT"
    
    # Get API key from Key Vault if available
    log_info "Attempting to retrieve API key from Key Vault..."
    
    KEYVAULT=$(az resource list \
        --query "[?type=='Microsoft.KeyVault/vaults' && contains(name, 'azab')] | [0].name" \
        -o tsv)
    
    if [ -n "$KEYVAULT" ]; then
        OPENAI_KEY=$(az keyvault secret show \
            --vault-name "$KEYVAULT" \
            --name "azure-openai-key" \
            --query value -o tsv 2>/dev/null || echo "")
        
        if [ -n "$OPENAI_KEY" ]; then
            log_success "Retrieved key from Key Vault: $KEYVAULT"
        fi
    fi
    
    # If no key found, prompt user
    if [ -z "$OPENAI_KEY" ]; then
        log_warning "Could not retrieve key from Key Vault"
        log_info "Please provide your Azure OpenAI API key:"
        read -sp "AZURE_OPENAI_API_KEY: " OPENAI_KEY
        echo ""
    fi
    
    # Get deployment names
    log_info "Getting deployment information..."
    DEPLOYMENTS=$(az cognitiveservices account deployment list \
        --name "$OPENAI_NAME" \
        --resource-group "$OPENAI_RG" \
        --query "[].name" -o tsv 2>/dev/null || echo "")
    
    if [ -n "$DEPLOYMENTS" ]; then
        log_success "Available deployments:"
        echo "$DEPLOYMENTS"
        GPT4_DEPLOYMENT=$(echo "$DEPLOYMENTS" | grep -i "gpt-4" | head -1 || echo "")
    fi
    
    export OPENAI_NAME OPENAI_RG OPENAI_ENDPOINT OPENAI_KEY GPT4_DEPLOYMENT
}

# Get Azure Storage configuration
get_storage_config() {
    log_section "Configuring Azure Storage"
    
    # Find Storage account
    STORAGE=$(az resource list \
        --query "[?type=='Microsoft.Storage/storageAccounts' && contains(name, 'azab')] | [0]" \
        -o json)
    
    if [ "$STORAGE" == "null" ] || [ -z "$STORAGE" ]; then
        log_warning "No Azure Storage account found"
        return
    fi
    
    STORAGE_NAME=$(echo "$STORAGE" | jq -r '.name')
    STORAGE_RG=$(echo "$STORAGE" | jq -r '.resourceGroup')
    
    log_success "Found Storage Account: $STORAGE_NAME"
    log_info "Resource Group: $STORAGE_RG"
    
    # Get storage connection string
    STORAGE_CONN=$(az storage account show-connection-string \
        --name "$STORAGE_NAME" \
        --resource-group "$STORAGE_RG" \
        --query connectionString -o tsv 2>/dev/null || echo "")
    
    if [ -n "$STORAGE_CONN" ]; then
        log_success "Retrieved connection string"
    fi
    
    # Get storage key
    STORAGE_KEY=$(az storage account keys list \
        --account-name "$STORAGE_NAME" \
        --resource-group "$STORAGE_RG" \
        --query "[0].value" -o tsv)
    
    log_success "Retrieved primary key"
    
    export STORAGE_NAME STORAGE_RG STORAGE_CONN STORAGE_KEY
}

# Get API Management configuration
get_apim_config() {
    log_section "Configuring API Management"
    
    # Find APIM resource
    APIM=$(az resource list \
        --query "[?type=='Microsoft.ApiManagement/service' && contains(name, 'azab')] | [0]" \
        -o json)
    
    if [ "$APIM" == "null" ] || [ -z "$APIM" ]; then
        log_warning "No API Management resource found"
        return
    fi
    
    APIM_NAME=$(echo "$APIM" | jq -r '.name')
    APIM_RG=$(echo "$APIM" | jq -r '.resourceGroup')
    APIM_LOCATION=$(echo "$APIM" | jq -r '.location')
    
    log_success "Found API Management: $APIM_NAME"
    log_info "Location: $APIM_LOCATION"
    
    # Get APIM endpoint
    APIM_ENDPOINT=$(az apim show \
        --name "$APIM_NAME" \
        --resource-group "$APIM_RG" \
        --query properties.gatewayUrl -o tsv)
    
    log_success "Endpoint: $APIM_ENDPOINT"
    
    export APIM_NAME APIM_RG APIM_ENDPOINT
}

# Get Key Vault configuration
get_keyvault_config() {
    log_section "Configuring Key Vault"
    
    # Find Key Vault
    KEYVAULT=$(az resource list \
        --query "[?type=='Microsoft.KeyVault/vaults' && contains(name, 'azab')] | [0]" \
        -o json)
    
    if [ "$KEYVAULT" == "null" ] || [ -z "$KEYVAULT" ]; then
        log_warning "No Key Vault found"
        return
    fi
    
    KEYVAULT_NAME=$(echo "$KEYVAULT" | jq -r '.name')
    KEYVAULT_RG=$(echo "$KEYVAULT" | jq -r '.resourceGroup')
    KEYVAULT_URL=$(echo "$KEYVAULT" | jq -r '.id')
    
    log_success "Found Key Vault: $KEYVAULT_NAME"
    
    # Get URI
    KEYVAULT_URI=$(az keyvault show \
        --name "$KEYVAULT_NAME" \
        --resource-group "$KEYVAULT_RG" \
        --query properties.vaultUri -o tsv)
    
    log_success "Vault URI: $KEYVAULT_URI"
    
    # List available secrets (first 5)
    log_info "Available secrets:"
    az keyvault secret list \
        --vault-name "$KEYVAULT_NAME" \
        --query "[0:5].name" -o tsv | while read secret; do
        echo "  - $secret"
    done
    
    export KEYVAULT_NAME KEYVAULT_RG KEYVAULT_URI
}

# Get Application Insights configuration
get_appinsights_config() {
    log_section "Configuring Application Insights"
    
    # Find App Insights
    APPINSIGHTS=$(az resource list \
        --query "[?type=='microsoft.insights/components' && contains(name, 'azab')] | [0]" \
        -o json)
    
    if [ "$APPINSIGHTS" == "null" ] || [ -z "$APPINSIGHTS" ]; then
        log_warning "No Application Insights found"
        return
    fi
    
    APPINSIGHTS_NAME=$(echo "$APPINSIGHTS" | jq -r '.name')
    APPINSIGHTS_RG=$(echo "$APPINSIGHTS" | jq -r '.resourceGroup')
    
    log_success "Found Application Insights: $APPINSIGHTS_NAME"
    
    # Get instrumentation key
    APPINSIGHTS_KEY=$(az monitor app-insights component show \
        --app "$APPINSIGHTS_NAME" \
        --resource-group "$APPINSIGHTS_RG" \
        --query instrumentationKey -o tsv)
    
    log_success "Instrumentation Key: ${APPINSIGHTS_KEY:0:20}..."
    
    export APPINSIGHTS_NAME APPINSIGHTS_RG APPINSIGHTS_KEY
}

# Generate environment file
generate_env_file() {
    log_section "Generating Environment Configuration"
    
    ENV_FILE=".env.production.azure"
    
    log_info "Creating $ENV_FILE..."
    
    cat > "$ENV_FILE" << 'ENVEOF'
# ============================================================================
# AzProud Azure Integration - Auto-Generated Configuration
# Generated: $(date)
# DO NOT commit this file to version control
# ============================================================================

################################################################################
# Azure Subscription Information
################################################################################
AZURE_SUBSCRIPTION_ID=SUBSCRIPTION_ID_PLACEHOLDER
AZURE_TENANT_ID=TENANT_ID_PLACEHOLDER

################################################################################
# Azure OpenAI Configuration
################################################################################
AZURE_OPENAI_API_KEY=OPENAI_KEY_PLACEHOLDER
AZURE_OPENAI_ENDPOINT=OPENAI_ENDPOINT_PLACEHOLDER
AZURE_OPENAI_DEPLOYMENT=GPT4_DEPLOYMENT_PLACEHOLDER
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_RESOURCE_NAME=OPENAI_NAME_PLACEHOLDER
AZURE_OPENAI_RESOURCE_GROUP=OPENAI_RG_PLACEHOLDER

################################################################################
# Azure Storage Configuration
################################################################################
AZURE_STORAGE_ACCOUNT_NAME=STORAGE_NAME_PLACEHOLDER
AZURE_STORAGE_ACCOUNT_KEY=STORAGE_KEY_PLACEHOLDER
AZURE_STORAGE_CONNECTION_STRING=STORAGE_CONN_PLACEHOLDER

################################################################################
# Azure Key Vault Configuration
################################################################################
AZURE_KEYVAULT_VAULT_NAME=KEYVAULT_NAME_PLACEHOLDER
AZURE_KEYVAULT_VAULT_URI=KEYVAULT_URI_PLACEHOLDER

################################################################################
# Azure API Management Configuration
################################################################################
AZURE_APIM_SERVICE_NAME=APIM_NAME_PLACEHOLDER
AZURE_APIM_ENDPOINT=APIM_ENDPOINT_PLACEHOLDER

################################################################################
# Azure Application Insights
################################################################################
AZURE_APPINSIGHTS_INSTRUMENTATION_KEY=APPINSIGHTS_KEY_PLACEHOLDER

################################################################################
# Azure Managed Identity (for authentication)
################################################################################
AZURE_USE_MANAGED_IDENTITY=true
AZURE_MANAGED_IDENTITY_CLIENT_ID=

################################################################################
# Logging and Monitoring
################################################################################
AZURE_LOG_LEVEL=info
AZURE_ENABLE_METRICS=true
ENABLE_APPINSIGHTS_LOGGING=true

ENVEOF

    # Replace placeholders with actual values
    sed -i "s|SUBSCRIPTION_ID_PLACEHOLDER|$SUBSCRIPTION_ID|g" "$ENV_FILE"
    sed -i "s|TENANT_ID_PLACEHOLDER|$TENANT_ID|g" "$ENV_FILE"
    sed -i "s|OPENAI_KEY_PLACEHOLDER|${OPENAI_KEY:0:20}...|g" "$ENV_FILE"
    sed -i "s|OPENAI_ENDPOINT_PLACEHOLDER|$OPENAI_ENDPOINT|g" "$ENV_FILE"
    sed -i "s|GPT4_DEPLOYMENT_PLACEHOLDER|$GPT4_DEPLOYMENT|g" "$ENV_FILE"
    sed -i "s|OPENAI_NAME_PLACEHOLDER|$OPENAI_NAME|g" "$ENV_FILE"
    sed -i "s|OPENAI_RG_PLACEHOLDER|$OPENAI_RG|g" "$ENV_FILE"
    sed -i "s|STORAGE_NAME_PLACEHOLDER|$STORAGE_NAME|g" "$ENV_FILE"
    sed -i "s|STORAGE_KEY_PLACEHOLDER|${STORAGE_KEY:0:20}...|g" "$ENV_FILE"
    sed -i "s|STORAGE_CONN_PLACEHOLDER|${STORAGE_CONN:0:50}...|g" "$ENV_FILE"
    sed -i "s|KEYVAULT_NAME_PLACEHOLDER|$KEYVAULT_NAME|g" "$ENV_FILE"
    sed -i "s|KEYVAULT_URI_PLACEHOLDER|$KEYVAULT_URI|g" "$ENV_FILE"
    sed -i "s|APIM_NAME_PLACEHOLDER|$APIM_NAME|g" "$ENV_FILE"
    sed -i "s|APIM_ENDPOINT_PLACEHOLDER|$APIM_ENDPOINT|g" "$ENV_FILE"
    sed -i "s|APPINSIGHTS_KEY_PLACEHOLDER|${APPINSIGHTS_KEY:0:20}...|g" "$ENV_FILE"
    
    log_success "Environment file created: $ENV_FILE"
    log_info "Remember to keep this file secure - do NOT commit it!"
}

# Generate TypeScript integration config
generate_ts_config() {
    log_section "Generating TypeScript Integration Configuration"
    
    CONFIG_FILE="src/lib/azure-config.ts"
    
    log_info "Creating $CONFIG_FILE..."
    
    cat > "$CONFIG_FILE" << 'TSEOF'
// Auto-generated Azure configuration
// Generated from Azure resources discovery

export const azureConfig = {
  subscription: {
    id: process.env.AZURE_SUBSCRIPTION_ID || "",
    tenantId: process.env.AZURE_TENANT_ID || "",
  },

  openai: {
    apiKey: process.env.AZURE_OPENAI_API_KEY || "",
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview",
    resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME || "",
    resourceGroup: process.env.AZURE_OPENAI_RESOURCE_GROUP || "",
  },

  storage: {
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || "",
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || "",
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || "",
  },

  keyVault: {
    vaultName: process.env.AZURE_KEYVAULT_VAULT_NAME || "",
    vaultUri: process.env.AZURE_KEYVAULT_VAULT_URI || "",
  },

  apim: {
    serviceName: process.env.AZURE_APIM_SERVICE_NAME || "",
    endpoint: process.env.AZURE_APIM_ENDPOINT || "",
  },

  appInsights: {
    instrumentationKey: process.env.AZURE_APPINSIGHTS_INSTRUMENTATION_KEY || "",
  },

  auth: {
    useManagedIdentity: process.env.AZURE_USE_MANAGED_IDENTITY === "true",
    managedIdentityClientId: process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID || "",
  },

  logging: {
    level: process.env.AZURE_LOG_LEVEL || "info",
    enableMetrics: process.env.AZURE_ENABLE_METRICS === "true",
    enableAppInsights: process.env.ENABLE_APPINSIGHTS_LOGGING === "true",
  },
};

// Helper functions for Azure SDK initialization
export function getOpenAIClient() {
  const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
  return new OpenAIClient(
    azureConfig.openai.endpoint,
    new AzureKeyCredential(azureConfig.openai.apiKey)
  );
}

export function getStorageClient() {
  const { BlobServiceClient } = require("@azure/storage-blob");
  return BlobServiceClient.fromConnectionString(azureConfig.storage.connectionString);
}

export function getKeyVaultClient() {
  const { SecretClient } = require("@azure/keyvault-secrets");
  const { DefaultAzureCredential } = require("@azure/identity");
  return new SecretClient(azureConfig.keyVault.vaultUri, new DefaultAzureCredential());
}

export async function getSecretFromKeyVault(secretName: string): Promise<string | undefined> {
  try {
    const client = getKeyVaultClient();
    const secret = await client.getSecret(secretName);
    return secret.value;
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretName}:`, error);
    return undefined;
  }
}
TSEOF

    log_success "TypeScript config created: $CONFIG_FILE"
}

# Install Azure SDK packages
install_azure_packages() {
    log_section "Installing Azure SDK Packages"
    
    PACKAGES=(
        "@azure/openai"
        "@azure/storage-blob"
        "@azure/identity"
        "@azure/keyvault-secrets"
        "@azure/app-insights-web-resource"
    )
    
    log_info "Installing required Azure packages..."
    
    for package in "${PACKAGES[@]}"; do
        log_info "Installing $package..."
        npm install "$package" 2>/dev/null && log_success "✓ $package" || log_warning "⚠ Failed to install $package"
    done
}

# Create integration script
create_integration_script() {
    log_section "Creating Integration Script"
    
    SCRIPT_FILE="scripts/azure-deploy.sh"
    
    log_info "Creating $SCRIPT_FILE..."
    
    cat > "$SCRIPT_FILE" << 'SCRIPTEOF'
#!/bin/bash
# Azure deployment integration script
# Deploys AzProud to Azure Container Instances with configurations

set -e

log_info() { echo "ℹ️  $1"; }
log_success() { echo "✓ $1"; }
log_error() { echo "❌ $1"; exit 1; }

log_info "Starting Azure deployment..."

# Load Azure configuration
if [ ! -f .env.production.azure ]; then
    log_error ".env.production.azure not found. Run azure-auto-setup.sh first."
fi

source .env.production.azure

log_info "Building application..."
npm run build

log_info "Creating Azure Container Registry image..."
az acr build \
    --registry "$(echo $AZURE_STORAGE_ACCOUNT_NAME | cut -d'a' -f1)acr" \
    --image azproud:latest .

log_info "Deploying to Azure Container Instances..."
az container create \
    --resource-group "$AZURE_OPENAI_RESOURCE_GROUP" \
    --name azproud-prod \
    --image "$(echo $AZURE_STORAGE_ACCOUNT_NAME | cut -d'a' -f1)acr.azurecr.io/azproud:latest" \
    --environment-variables \
        AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
        AZURE_OPENAI_DEPLOYMENT="$AZURE_OPENAI_DEPLOYMENT" \
        AZURE_STORAGE_ACCOUNT_NAME="$AZURE_STORAGE_ACCOUNT_NAME" \
    --cpu 2 \
    --memory 4 \
    --port 3000

log_success "Deployment complete!"
SCRIPTEOF

    chmod +x "$SCRIPT_FILE"
    log_success "Integration script created: $SCRIPT_FILE"
}

# Display summary
display_summary() {
    log_section "Configuration Summary"
    
    cat << SUMMARY
╔════════════════════════════════════════════════════════════════════╗
║                   Azure Integration Summary                        ║
╚════════════════════════════════════════════════════════════════════╝

✓ Subscription Information:
  • Subscription ID: $SUBSCRIPTION_ID
  • Tenant ID: $TENANT_ID

✓ Azure OpenAI:
  • Resource: $OPENAI_NAME
  • Endpoint: $OPENAI_ENDPOINT
  • Deployment: $GPT4_DEPLOYMENT
  • Location: $OPENAI_LOCATION

✓ Storage Account:
  • Account: $STORAGE_NAME
  • Resource Group: $STORAGE_RG

✓ Key Vault:
  • Name: $KEYVAULT_NAME
  • URI: $KEYVAULT_URI

✓ API Management:
  • Service: $APIM_NAME
  • Endpoint: $APIM_ENDPOINT

✓ Application Insights:
  • Name: $APPINSIGHTS_NAME
  • Status: Configured

Generated Files:
  ✓ .env.production.azure (environment variables)
  ✓ src/lib/azure-config.ts (TypeScript configuration)
  ✓ scripts/azure-deploy.sh (deployment script)

Next Steps:
1. Review .env.production.azure and verify all values
2. Update .env.production with sensitive values
3. Run: npm run build
4. Deploy using: ./scripts/azure-deploy.sh

Security Reminders:
⚠ Keep .env.production.azure secure - do NOT commit
⚠ Store API keys in Azure Key Vault
⚠ Use Managed Identities where possible
⚠ Enable Application Insights logging

SUMMARY
}

# Main execution
main() {
    log_section "AzProud - Azure Auto Integration Setup"
    
    check_prerequisites
    check_azure_login
    discover_resources
    get_openai_config
    get_storage_config
    get_apim_config
    get_keyvault_config
    get_appinsights_config
    generate_env_file
    generate_ts_config
    install_azure_packages
    create_integration_script
    display_summary
    
    log_success "Azure integration setup complete!"
}

main "$@"
