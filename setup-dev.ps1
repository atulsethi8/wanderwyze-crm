# Development Environment Setup Script
# This script helps you create the .env.local file for development

Write-Host "Setting up development environment for WanderWyze CRM..." -ForegroundColor Green

# Check if .env.local already exists
if (Test-Path ".env.local") {
    Write-Host "Warning: .env.local already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit
    }
}

# Create .env.local file
$envContent = @"
# Development Environment Variables
# Replace these placeholder values with your actual API keys

# Supabase Credentials (User defined prefix, e.g. VITE_)
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Google Gemini API Key (MUST be named API_KEY)
API_KEY=YOUR_GOOGLE_GEMINI_API_KEY

# Alternative Gemini API Key name (also supported)
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
"@

$envContent | Out-File -FilePath ".env.local" -Encoding UTF8

Write-Host "Created .env.local file successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env.local and replace the placeholder values with your actual API keys" -ForegroundColor White
Write-Host "2. Get your Supabase credentials from: https://supabase.com" -ForegroundColor White
Write-Host "3. Get your Gemini API key from: https://makersuite.google.com/app/apikey" -ForegroundColor White
Write-Host "4. Run 'npm run dev' to start the development server" -ForegroundColor White
Write-Host ""
Write-Host "Your application will be available at: http://localhost:5173" -ForegroundColor Green

