$ErrorActionPreference = 'Stop'
$restoreScript = Join-Path $PSScriptRoot '../scripts/backups/restore-auth.ps1'
$global:firebaseAuthRestoreTestState = @{}

# Exercise the actual helper with in-process API doubles. No credentials or network are used.
function gcloud {
    $global:LASTEXITCODE = 0
    return 'test-token'
}
function Invoke-RestMethod {
    param($Uri, $Method, $Headers, $ContentType, $Body)
    $url = [uri]::UnescapeDataString($Uri)
    if ($url -like '*storage.googleapis.com*') {
        if ($url -like '*/manifest.json?*') {
            return [pscustomobject]@{
                sourceProject = 'cgs-games'
                auth = @{ users = 2 }
                artifacts = @(@{ name = 'runs/test/auth/users-000000.json' })
            }
        }
        if ($url -like '*/auth/config.json?*') {
            return @{ signIn = @{ hashConfig = @{ algorithm = 'SCRYPT'; signerKey = 'test-key' } } }
        }
        if ($url -like '*/auth/users-000000.json?*') {
            return @{ users = @([pscustomobject]@{ localId = 'alice' }, [pscustomobject]@{ localId = 'bob' }) }
        }
    }
    if ($url -like '*accounts:batchGet?maxResults=1') {
        if ($global:firebaseAuthRestoreTestState.scenario -eq 'nonempty') { return @{ users = @(@{ localId = 'existing' }) } }
        return @{}
    }
    if ($url -like '*accounts:batchCreate') {
        $request = $Body | ConvertFrom-Json
        $global:firebaseAuthRestoreTestState.importedIds = @($request.users.localId)
        if (@($request.users | Where-Object { -not $_.disabled }).Count) { throw 'Test enabled an account' }
        if ($global:firebaseAuthRestoreTestState.scenario -eq 'partial') { return @{ error = @(@{ message = 'TEST_IMPORT_ERROR' }) } }
        return @{}
    }
    if ($url -like '*accounts:batchGet?maxResults=1000*') {
        if ($global:firebaseAuthRestoreTestState.scenario -eq 'mismatch') { return @{ users = @(@{ localId = 'alice'; disabled = $true }) } }
        return @{ users = @(@{ localId = 'alice'; disabled = ($global:firebaseAuthRestoreTestState.scenario -ne 'enabled') }, @{ localId = 'bob'; disabled = $true }) }
    }
    if ($url -like '*accounts:batchDelete') {
        $request = $Body | ConvertFrom-Json
        $global:firebaseAuthRestoreTestState.deletedIds += @($request.localIds)
        if ($global:firebaseAuthRestoreTestState.scenario -eq 'cleanup-failure') { return @{ errors = @(@{ message = 'TEST_CLEANUP_ERROR' }) } }
        return @{}
    }
    throw "Unexpected test API: $url"
}

$cases = @(
    @{ name = 'success'; testOnly = $true; expected = ''; deleted = 'alice,bob' },
    @{ name = 'partial'; testOnly = $true; expected = 'Auth import reported'; deleted = 'alice,bob' },
    @{ name = 'enabled'; testOnly = $true; expected = 'unexpectedly enabled'; deleted = 'alice,bob' },
    @{ name = 'mismatch'; testOnly = $true; expected = 'identities do not match'; deleted = 'alice,bob' },
    @{ name = 'partial'; testOnly = $false; expected = 'Auth import reported'; deleted = '' },
    @{ name = 'nonempty'; testOnly = $true; expected = 'Target Auth must be empty'; deleted = '' },
    @{ name = 'cleanup-failure'; testOnly = $true; expected = 'cleanup failed'; deleted = 'alice,bob' }
)
foreach ($case in $cases) {
    $global:firebaseAuthRestoreTestState.scenario = $case.name
    $global:firebaseAuthRestoreTestState.deletedIds = @()
    $global:firebaseAuthRestoreTestState.importedIds = @()
    $failure = ''
    $result = $null
    try {
        $result = & $restoreScript -Run '2026-10-13T04-07-20-762Z-abcd' -TargetProject 'cgs-games-backups' -TestOnly:$case.testOnly
    } catch { $failure = $_.Exception.Message }
    if (($case.expected -eq '' -and $failure) -or ($case.expected -ne '' -and -not $failure.Contains($case.expected))) {
        throw "Unexpected result for $($case.name): $failure"
    }
    if (($global:firebaseAuthRestoreTestState.deletedIds -join ',') -ne $case.deleted) { throw "Wrong cleanup IDs for $($case.name)" }
    if ($case.expected -eq '' -and (-not $result.testAccountsRemoved -or $result.usersRestored -ne 2)) { throw 'Missing success report' }
    Write-Output "PASS Auth restore $($case.name), TestOnly=$($case.testOnly)"
}
Write-Output "$($cases.Count) Auth recovery tests passed."
