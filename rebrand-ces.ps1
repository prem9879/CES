# Rebrand CES labels to standardized wording
$baseDir = Get-Location

# Critical files to rebrand
$files = @(
    "package.json",
    "HF/package.json",
    "src/store/index.ts",
    "src/app/layout.tsx",
    "src/components/Sidebar.tsx",
    "src/components/SettingsModal.tsx",
    "src/components/ChatInput.tsx",
    "api/server.ts",
    "api/middleware/auth.ts",
    "api/lib/tiers.ts",
    ".env.example",
    "README.md",
    "API.md",
    "ARCHITECTURE.md"
)

$count = 0
foreach ($file in $files) {
    $path = Join-Path $baseDir $file
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        $updated = $content `
            -replace 'CES API v0.4.0', 'Cognitive Execution System (CES) API v0.4.0' `
            -replace '"CES Core"', '"CES Core"'
        
        if ($updated -ne $content) {
            [System.IO.File]::WriteAllText($path, $updated)
            Write-Host "✅ $file"
            $count++
        }
    }
}

Write-Host "`n✨ Rebranded $count files to CES"
