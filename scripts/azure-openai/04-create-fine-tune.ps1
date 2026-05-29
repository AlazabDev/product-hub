<#
.SYNOPSIS
    Create Fine-tuning Job on Azure OpenAI
.DESCRIPTION
    Creates a fine-tuning job using uploaded training data
.PARAMETER BaseModel
    Base model to fine-tune (default: gpt-4o-2024-08-06)
.PARAMETER Suffix
    Custom suffix for the fine-tuned model name
.PARAMETER Epochs
    Number of training epochs (default: 3)
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$BaseModel = "gpt-4o-2024-08-06",
    
    [Parameter(Mandatory=$false)]
    [string]$Suffix = "alazab-paop",
    
    [Parameter(Mandatory=$false)]
    [int]$Epochs = 3,
    
    [Parameter(Mandatory=$false)]
    [double]$LearningRateMultiplier = 1.0
)

$ErrorActionPreference = "Stop"

# Load configurations
@(".env.azure", ".env.files") | ForEach-Object {
    if (Test-Path $_) {
        Get-Content $_ | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
                [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
            }
        }
    }
}

$endpoint = $env:AZURE_OPENAI_ENDPOINT
$apiKey = $env:AZURE_OPENAI_API_KEY
$apiVersion = $env:AZURE_OPENAI_API_VERSION
$trainingFileId = $env:TRAINING_FILE_ID
$validationFileId = $env:VALIDATION_FILE_ID

if (-not $endpoint -or -not $apiKey) {
    Write-Error "Missing Azure OpenAI credentials"
    exit 1
}

if (-not $trainingFileId) {
    Write-Error "Missing training file ID. Run 03-upload-training-data.ps1 first."
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Create Fine-tuning Job" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Base Model: $BaseModel"
Write-Host "  Suffix: $Suffix"
Write-Host "  Epochs: $Epochs"
Write-Host "  Learning Rate Multiplier: $LearningRateMultiplier"
Write-Host "  Training File: $trainingFileId"
Write-Host "  Validation File: $validationFileId"
Write-Host ""

# Create fine-tuning job
$uri = "$endpoint/openai/fine_tuning/jobs?api-version=$apiVersion"

$headers = @{
    "api-key" = $apiKey
    "Content-Type" = "application/json"
}

$body = @{
    model = $BaseModel
    training_file = $trainingFileId
    suffix = $Suffix
    hyperparameters = @{
        n_epochs = $Epochs
        learning_rate_multiplier = $LearningRateMultiplier
    }
} | ConvertTo-Json -Depth 10

if ($validationFileId) {
    $bodyObj = $body | ConvertFrom-Json
    $bodyObj | Add-Member -NotePropertyName "validation_file" -NotePropertyValue $validationFileId
    $body = $bodyObj | ConvertTo-Json -Depth 10
}

Write-Host "Creating fine-tuning job..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Fine-tuning Job Created!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Job Details:" -ForegroundColor Cyan
    Write-Host "  Job ID: $($response.id)"
    Write-Host "  Status: $($response.status)"
    Write-Host "  Model: $($response.model)"
    Write-Host "  Created: $($response.created_at)"
    Write-Host ""
    
    # Save job ID
    "FINE_TUNE_JOB_ID=$($response.id)" | Out-File -FilePath ".env.finetune" -Encoding UTF8
    
    Write-Host "Job ID saved to .env.finetune" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Monitor progress with:" -ForegroundColor Yellow
    Write-Host "  ./04-check-status.ps1"
    Write-Host ""
    Write-Host "Fine-tuning typically takes 30-60 minutes depending on data size." -ForegroundColor Gray
}
catch {
    Write-Error "Failed to create fine-tuning job: $_"
    exit 1
}
