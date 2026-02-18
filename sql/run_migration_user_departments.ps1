<#
Runs backup, migration, and verification for user_departments migration on Windows.

Usage: Open PowerShell as Administrator (or user with MySQL client in PATH) and run:
  ./run_migration_user_departments.ps1

Options: You will be prompted for DB name, DB user, and password. Defaults shown in prompts may be accepted.

Security: Password is read as SecureString then converted for the duration of the script. The plain password is not written to disk.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-PlainPassword {
    param([string]$Prompt = 'MySQL password')
    $secure = Read-Host -AsSecureString -Prompt $Prompt
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

# Defaults and paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = (Get-Item $scriptDir).Parent.Parent.FullName
$migrationFile = Join-Path $scriptDir '2026-02-02_migrate_user_departments.sql'

Write-Host "Migration file: $migrationFile"

if (-not (Test-Path $migrationFile)) {
    Write-Error "Migration file not found: $migrationFile"
    exit 1
}

$dbName = Read-Host -Prompt 'Database name (default: document_request_db)'
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = 'document_request_db' }
$dbUser = Read-Host -Prompt 'MySQL user (default: root)'
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = 'root' }
$dbPass = Read-PlainPassword -Prompt "Password for $dbUser"

Write-Host "Using DB: $dbName (user: $dbUser)"

# Check executables
if (-not (Get-Command mysqldump -ErrorAction SilentlyContinue)) {
    Write-Error "mysqldump not found in PATH. Install MySQL client or add it to PATH."
    exit 2
}
if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
    Write-Error "mysql client not found in PATH. Install MySQL client or add it to PATH."
    exit 2
}

# Backup
$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$backupFile = Join-Path $repoRoot "document_request_db_backup_$timestamp.sql"
Write-Host "Creating backup: $backupFile"

$mysqldumpArgs = @('-u', $dbUser, ("-p$dbPass"), $dbName)
try {
    & mysqldump @mysqldumpArgs | Out-File -FilePath $backupFile -Encoding ASCII
    Write-Host "Backup complete"
} catch {
    Write-Error "Backup failed: $_"
    exit 3
}

# Apply migration (pipe file into mysql)
Write-Host "Applying migration: $migrationFile"
try {
    Get-Content -Path $migrationFile -Raw | & mysql -u $dbUser ("-p$dbPass") $dbName
    Write-Host "Migration applied successfully"
} catch {
    Write-Error "Migration failed: $_"
    Write-Host "You can restore from backup with: mysql -u $dbUser -p $dbName < $backupFile"
    exit 4
}

# Verification queries
Write-Host "Running verification queries..."
$queries = @(
    @{ name = 'Users with legacy department_id (should be 0 after DROP)'; sql = 'SELECT COUNT(*) FROM users WHERE department_id IS NOT NULL;' },
    @{ name = 'Total user_departments rows'; sql = 'SELECT COUNT(*) FROM user_departments;' },
    @{ name = 'Sample mapping for user 619'; sql = "SELECT u.id, u.department_id AS legacy, GROUP_CONCAT(ud.department_id) AS dept_ids FROM users u LEFT JOIN user_departments ud ON ud.user_id = u.id WHERE u.id = 619 GROUP BY u.id;" }
)

foreach ($q in $queries) {
    Write-Host "- $($q.name)"
    try {
        $out = & mysql -u $dbUser ("-p$dbPass") -D $dbName -s -N -e $q.sql
        if ($LASTEXITCODE -ne 0) { throw "mysql returned exit code $LASTEXITCODE" }
        Write-Host $out
    } catch {
        Write-Error "Verification query failed: $_"
    }
}

Write-Host "Migration run complete. If results look good, commit the migration file to git."
