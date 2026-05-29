<#
.SYNOPSIS
    Upload training data to Azure OpenAI
.DESCRIPTION
    Uploads JSONL training and validation files to Azure OpenAI for fine-tuning
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$TrainingFile = "training-data/training.jsonl",
    
    [Parameter(Mandatory=$false)]
    [string]$ValidationFile = "training-data/validation.jsonl"
)

$ErrorActionPreference = "Stop"

# Load Azure configuration
if (Test-Path ".env.azure") {
    Get-Content ".env.azure" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

$endpoint = $env:AZURE_OPENAI_ENDPOINT
$apiKey = $env:AZURE_OPENAI_API_KEY
$apiVersion = $env:AZURE_OPENAI_API_VERSION

if (-not $endpoint -or -not $apiKey) {
    Write-Error "Missing Azure OpenAI credentials. Run 01-setup-resources.ps1 first."
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Upload Training Data to Azure OpenAI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to upload file
function Upload-TrainingFile {
    param(
        [string]$FilePath,
        [string]$Purpose
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Error "File not found: $FilePath"
        return $null
    }

    $fileSize = (Get-Item $FilePath).Length
    $fileName = Split-Path $FilePath -Leaf
    
    Write-Host "Uploading $fileName ($([math]::Round($fileSize/1KB, 2)) KB)..." -ForegroundColor Yellow

    $uri = "$endpoint/openai/files?api-version=$apiVersion"
    
    $headers = @{
        "api-key" = $apiKey
    }

    $form = @{
        purpose = $Purpose
        file = Get-Item -Path $FilePath
    }

    try {
        $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Form $form
        Write-Host "  Uploaded successfully. File ID: $($response.id)" -ForegroundColor Green
        return $response.id
    }
    catch {
        Write-Error "Failed to upload file: $_"
        return $null
    }
}

# Upload training file
Write-Host "[1/2] Uploading training file..." -ForegroundColor Yellow
$trainingFileId = Upload-TrainingFile -FilePath $TrainingFile -Purpose "fine-tune"

if (-not $trainingFileId) {
    exit 1
}

# Upload validation file
Write-Host "[2/2] Uploading validation file..." -ForegroundColor Yellow
$validationFileId = Upload-TrainingFile -FilePath $ValidationFile -Purpose "fine-tune"

if (-not $validationFileId) {
    exit 1
}

# Save file IDs for next script
$fileIds = @"
TRAINING_FILE_ID=$trainingFileId
VALIDATION_FILE_ID=$validationFileId
"@

$fileIds | Out-File -FilePath ".env.files" -Encoding UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Upload Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "File IDs saved to .env.files"
Write-Host "Training File ID:   $trainingFileId"
Write-Host "Validation File ID: $validationFileId"
Write-Host ""
Write-Host "Next step: Run 04-create-fine-tune.ps1" -ForegroundColor Yellow
