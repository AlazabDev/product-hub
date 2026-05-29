<#
.SYNOPSIS
    Deploy Fine-tuned Model
.DESCRIPTION
    Deploys the fine-tuned model to a new deployment for production use
.PARAMETER DeploymentName
    Name for the deployment (default: alazab-paop-assistant)
.PARAMETER Capacity
    TPM capacity (default: 10)
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$DeploymentName = "alazab-paop-assistant",
    
    [Parameter(Mandatory=$false)]
    [int]$Capacity = 10
)

$ErrorActionPreference = "Stop"

# Load configurations
@(".env.azure", ".env.model") | ForEach-Object {
    if (Test-Path $_) {
        Get-Content $_ | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
                [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
            }
        }
    }
}

$resourceGroup = $env:AZURE_OPENAI_RESOURCE_GROUP
$resourceName = $env:AZURE_OPENAI_RESOURCE_NAME
$fineTunedModel = $env:FINE_TUNED_MODEL

if (-not $fineTunedModel) {
    Write-Error "No fine-tuned model found. Wait for fine-tuning to complete."
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploy Fine-tuned Model" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Model: $fineTunedModel"
Write-Host "  Deployment: $DeploymentName"
Write-Host "  Capacity: $Capacity TPM"
Write-Host ""

Write-Host "Creating deployment..." -ForegroundColor Yellow

az cognitiveservices account deployment create `
    --name $resourceName `
    --resource-group $resourceGroup `
    --deployment-name $DeploymentName `
    --model-name $fineTunedModel `
    --model-format "OpenAI" `
    --sku-capacity $Capacity `
    --sku-name "Standard"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Deployment Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your custom AI model is now ready to use!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Add these to your application's .env:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "AZURE_OPENAI_DEPLOYMENT_NAME=$DeploymentName"
    Write-Host ""
    Write-Host "Usage in code:" -ForegroundColor Cyan
    Write-Host @"

import { AzureOpenAI } from "openai";

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deployment: "$DeploymentName",
});

const response = await client.chat.completions.create({
  model: "$DeploymentName",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: "ما هي تفاصيل المنتج AZ-PRD-001؟" }
  ]
});
"@
}
else {
    Write-Error "Deployment failed"
}
