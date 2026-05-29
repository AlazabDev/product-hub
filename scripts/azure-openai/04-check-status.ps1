<#
.SYNOPSIS
    Check Fine-tuning Job Status
.DESCRIPTION
    Monitors the status of a fine-tuning job
#>

$ErrorActionPreference = "Stop"

# Load configurations
@(".env.azure", ".env.finetune") | ForEach-Object {
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
$jobId = $env:FINE_TUNE_JOB_ID

if (-not $jobId) {
    Write-Error "No fine-tuning job ID found. Run 04-create-fine-tune.ps1 first."
    exit 1
}

$uri = "$endpoint/openai/fine_tuning/jobs/$jobId`?api-version=$apiVersion"

$headers = @{
    "api-key" = $apiKey
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fine-tuning Job Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers
    
    $statusColor = switch ($response.status) {
        "succeeded" { "Green" }
        "failed" { "Red" }
        "cancelled" { "Red" }
        "running" { "Yellow" }
        "pending" { "Yellow" }
        default { "White" }
    }
    
    Write-Host "Job ID: $($response.id)"
    Write-Host "Status: " -NoNewline
    Write-Host $response.status -ForegroundColor $statusColor
    Write-Host "Model: $($response.model)"
    Write-Host "Created: $($response.created_at)"
    
    if ($response.fine_tuned_model) {
        Write-Host ""
        Write-Host "Fine-tuned Model: $($response.fine_tuned_model)" -ForegroundColor Green
        
        # Save model name
        "FINE_TUNED_MODEL=$($response.fine_tuned_model)" | Out-File -FilePath ".env.model" -Encoding UTF8
        Write-Host "Model name saved to .env.model"
        Write-Host ""
        Write-Host "Next step: Run 05-deploy-model.ps1" -ForegroundColor Yellow
    }
    
    if ($response.error) {
        Write-Host ""
        Write-Host "Error: $($response.error.message)" -ForegroundColor Red
    }
    
    # Show training metrics if available
    if ($response.result_files) {
        Write-Host ""
        Write-Host "Result files available for download"
    }
}
catch {
    Write-Error "Failed to get job status: $_"
}
