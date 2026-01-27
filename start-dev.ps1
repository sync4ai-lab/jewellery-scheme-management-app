# Start development server with Node.js via nvm
Write-Host "Activating Node.js 20.19.0..." -ForegroundColor Green

# Set Node path directly
$nvmPath = $env:NVM_HOME
$nodePath = "$nvmPath\v20.19.0"
$env:Path = "$nodePath;$env:Path"

# Verify Node is active
Write-Host "`nNode version:" -ForegroundColor Cyan
node --version
Write-Host "npm version:" -ForegroundColor Cyan
npm --version

Write-Host "`nStarting development server..." -ForegroundColor Green
npm run dev
