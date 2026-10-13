[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Run,
    [Parameter(Mandatory)][string]$TargetProject,
    [string]$ArchiveBucket = 'cgs-games-backups-archive',
    [switch]$EnableUsers,
    [switch]$TestOnly
)
$ErrorActionPreference = 'Stop'
if ($TargetProject -eq 'cgs-games' -or $TargetProject -notmatch '^[a-z][a-z0-9-]{4,28}[a-z0-9]$') {
    throw 'Auth restore requires a separate recovery project; production is forbidden.'
}
if ($Run -notmatch '^[0-9TZ.a-f:-]+$') { throw 'Invalid backup run identifier.' }
if ($TestOnly -and ($TargetProject -ne 'cgs-games-backups' -or $EnableUsers)) {
    throw 'TestOnly is restricted to disabled accounts in the dedicated backup project.'
}
function Invoke-RecoveryApi([string]$Uri, [string]$Method = 'GET', $Body) {
    $token = & gcloud auth print-access-token
    if ($LASTEXITCODE -ne 0) { throw 'Google Cloud login required.' }
    $options = @{ Uri = $Uri; Method = $Method; Headers = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $TargetProject } }
    if ($null -ne $Body) { $options.ContentType = 'application/json'; $options.Body = $Body | ConvertTo-Json -Depth 50 -Compress }
    # Responses can contain personal data. Callers must capture them, never write them to a log.
    Invoke-RestMethod @options
}
function Get-ArchiveJson([string]$Name) {
    Invoke-RecoveryApi "https://storage.googleapis.com/storage/v1/b/$ArchiveBucket/o/$([uri]::EscapeDataString($Name))?alt=media"
}
$manifest = Get-ArchiveJson "runs/$Run/manifest.json"
if ($manifest.sourceProject -eq $TargetProject) { throw 'Cannot restore over the source project.' }
$existing = Invoke-RecoveryApi "https://identitytoolkit.googleapis.com/v1/projects/$TargetProject/accounts:batchGet?maxResults=1"
if (@($existing.users).Where({ $null -ne $_ }).Count -gt 0) { throw 'Target Auth must be empty. Use a new recovery project.' }
$config = Get-ArchiveJson "runs/$Run/auth/config.json"
$hash = $config.signIn.hashConfig
if ($hash.algorithm -ne 'SCRYPT' -or -not $hash.signerKey) { throw 'This restore helper requires Firebase SCRYPT configuration.' }
$ids = [System.Collections.Generic.List[string]]::new()
try {
    foreach ($artifact in $manifest.artifacts | Where-Object { $_.name -match '/auth/users-[0-9]+\.json$' } | Sort-Object name) {
        $page = Get-ArchiveJson $artifact.name
        $users = @($page.users | ForEach-Object {
            $user = @{}
            foreach ($field in @('localId', 'email', 'emailVerified', 'passwordHash', 'salt', 'displayName', 'photoUrl', 'createdAt', 'lastLoginAt', 'phoneNumber', 'customAttributes', 'providerUserInfo', 'mfaInfo', 'disabled')) {
                if ($_.PSObject.Properties.Name -contains $field) { $user[$field] = $_.$field }
            }
            if ($user.providerUserInfo) {
                # Download responses include server-generated federatedId values that must not be reimported.
                $user.providerUserInfo = @($user.providerUserInfo | ForEach-Object {
                    $provider = @{}
                    foreach ($field in @('providerId', 'rawId', 'email', 'displayName', 'photoUrl')) {
                        if ($_.PSObject.Properties.Name -contains $field) { $provider[$field] = $_.$field }
                    }
                    if (-not $provider.rawId) { throw 'Provider record lacks the original federated user ID.' }
                    $provider
                })
            }
            if (-not $EnableUsers) { $user.disabled = $true }
            $ids.Add($user.localId)
            $user
        })
        if ($users.Count -eq 0) { continue }
        $body = @{ users = $users; hashAlgorithm = $hash.algorithm; signerKey = $hash.signerKey; saltSeparator = $hash.saltSeparator; rounds = $hash.rounds; memoryCost = $hash.memoryCost; allowOverwrite = $false; sanityCheck = $true }
        $result = Invoke-RecoveryApi -Uri "https://identitytoolkit.googleapis.com/v1/projects/$TargetProject/accounts:batchCreate" -Method POST -Body $body
        if ($result.error) {
            $codes = @($result.error | ForEach-Object { ($_.message -split ':', 2)[0] -replace '[A-Za-z0-9+/=_-]{20,}', '[redacted]' } | Sort-Object -Unique)
            $guidance = if ($TestOnly) { 'Test-only cleanup will be attempted.' } else { 'Target may contain a partial restore; inspect it before retrying.' }
            throw "Auth import reported $(@($result.error).Count) errors ($($codes -join ', ')). $guidance"
        }
    }
    $restoredIds = [System.Collections.Generic.HashSet[string]]::new()
    $pageToken = ''
    do {
        $page = Invoke-RecoveryApi "https://identitytoolkit.googleapis.com/v1/projects/$TargetProject/accounts:batchGet?maxResults=1000&nextPageToken=$([uri]::EscapeDataString($pageToken))"
        foreach ($user in $page.users) {
            if (-not $EnableUsers -and -not $user.disabled) { throw 'Restored test account is unexpectedly enabled.' }
            $null = $restoredIds.Add($user.localId)
        }
        $pageToken = $page.nextPageToken
    } while ($pageToken)
    if ($restoredIds.Count -ne $manifest.auth.users -or $ids.Count -ne $manifest.auth.users -or @($ids | Where-Object { -not $restoredIds.Contains($_) }).Count -ne 0) {
        throw 'Restored Auth identities do not match the backup.'
    }
} finally {
    if ($TestOnly -and $ids.Count -gt 0) {
        for ($index = 0; $index -lt $ids.Count; $index += 1000) {
            $batch = @($ids | Select-Object -Skip $index -First 1000)
            $deleted = Invoke-RecoveryApi -Uri "https://identitytoolkit.googleapis.com/v1/projects/$TargetProject/accounts:batchDelete" -Method POST -Body @{ localIds = $batch; force = $true }
            if ($deleted.errors) { throw 'Auth drill cleanup failed; inspect disabled test users.' }
        }
    }
}
[pscustomobject]@{ run = $Run; targetProject = $TargetProject; usersRestored = $ids.Count; originalUidsVerified = $true; usersEnabled = [bool]$EnableUsers; testAccountsRemoved = [bool]$TestOnly }
