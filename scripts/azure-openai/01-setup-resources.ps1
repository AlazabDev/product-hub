<#
.SYNOPSIS
    Alazab PAOP - Azure OpenAI Resources Setup Script
.DESCRIPTION
    يقوم هذا السكربت بانشاء جميع موارد Azure المطلوبة لنموذج AI المخصص
.PARAMETER SubscriptionId
    معرف الاشتراك في Azure
.PARAMETER ResourceGroup
    اسم مجموعة الموارد
.PARAMETER Location
    الموقع الجغرافي (swedencentral recommended for fine-tuning)
.PARAMETER OpenAIResourceName
    اسم مورد OpenAI
.EXAMPLE
    ./01-setup-resources.ps1 -SubscriptionId "xxx" -ResourceGroup "alazab-ai-rg" -Location "swedencentral"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "alazab-paop-ai-rg",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "swedencentral",
    
    [Parameter(Mandatory=$false)]
    [string]$OpenAIResourceName = "alazab-paop-openai"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Alazab PAOP - Azure OpenAI Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# التحقق من تسجيل الدخول
Write-Host "[1/6] Checking Azure CLI login..." -ForegroundColor Yellow
$loginStatus = az account show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Starting login..." -ForegroundColor Red
    az login
}

# تعيين الاشتراك
Write-Host "[2/6] Setting subscription: $SubscriptionId" -ForegroundColor Yellow
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set subscription"
    exit 1
}

# انشاء Resource Group
Write-Host "[3/6] Creating Resource Group: $ResourceGroup" -ForegroundColor Yellow
az group create `
    --name $ResourceGroup `
    --location $Location `
    --tags "Project=AlazabPAOP" "Environment=Production" "ManagedBy=Script"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create resource group"
    exit 1
}

# التحقق من تسجيل مزود الخدمة
Write-Host "[4/6] Registering Microsoft.CognitiveServices provider..." -ForegroundColor Yellow
az provider register --namespace Microsoft.CognitiveServices --wait

# انشاء Azure OpenAI Resource
Write-Host "[5/6] Creating Azure OpenAI Resource: $OpenAIResourceName" -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray

az cognitiveservices account create `
    --name $OpenAIResourceName `
    --resource-group $ResourceGroup `
    --location $Location `
    --kind "OpenAI" `
    --sku "S0" `
    --custom-domain $OpenAIResourceName `
    --tags "Project=AlazabPAOP" "Purpose=CustomModel"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create Azure OpenAI resource"
    exit 1
}

# الحصول على المفاتيح والـ Endpoint
Write-Host "[6/6] Retrieving keys and endpoint..." -ForegroundColor Yellow

$endpoint = az cognitiveservices account show `
    --name $OpenAIResourceName `
    --resource-group $ResourceGroup `
    --query "properties.endpoint" -o tsv

$keys = az cognitiveservices account keys list `
    --name $OpenAIResourceName `
    --resource-group $ResourceGroup | ConvertFrom-Json

# نشر نموذج GPT-4o الاساسي للـ Fine-tuning
Write-Host ""
Write-Host "Deploying base GPT-4o model for fine-tuning..." -ForegroundColor Yellow

az cognitiveservices account deployment create `
    --name $OpenAIResourceName `
    --resource-group $ResourceGroup `
    --deployment-name "gpt-4o-base" `
    --model-name "gpt-4o" `
    --model-version "2024-08-06" `
    --model-format "OpenAI" `
    --sku-capacity 10 `
    --sku-name "Standard"

# عرض النتائج
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Completed Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Resource Details:" -ForegroundColor Cyan
Write-Host "  Resource Group:  $ResourceGroup" 
Write-Host "  OpenAI Resource: $OpenAIResourceName"
Write-Host "  Location:        $Location"
Write-Host ""
Write-Host "Connection Details (Add to .env):" -ForegroundColor Cyan
Write-Host "  AZURE_OPENAI_ENDPOINT=$endpoint"
Write-Host "  AZURE_OPENAI_API_KEY=$($keys.key1)"
Write-Host "  AZURE_OPENAI_API_VERSION=2024-02-01"
Write-Host ""

# حفظ المتغيرات في ملف
$envContent = @"
# Azure OpenAI Configuration - Generated $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
AZURE_OPENAI_ENDPOINT=$endpoint
AZURE_OPENAI_API_KEY=$($keys.key1)
AZURE_OPENAI_API_VERSION=2024-02-01
AZURE_OPENAI_RESOURCE_GROUP=$ResourceGroup
AZURE_OPENAI_RESOURCE_NAME=$OpenAIResourceName
"@

$envContent | Out-File -FilePath ".env.azure" -Encoding UTF8
Write-Host "Configuration saved to .env.azure" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Run 02-generate-training-data.ts to prepare training data" -ForegroundColor Yellow
