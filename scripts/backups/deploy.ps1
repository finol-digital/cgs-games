[CmdletBinding()]
param(
    [string]$SourceProject = 'cgs-games',
    [string]$BackupProject = 'cgs-games-backups',
    [string]$Region = 'us-central1',
    [string]$ArchiveBucket = 'cgs-games-backups-archive',
    [string]$ExportBucket = 'cgs-games-backups-exports',
    [string]$SourceBucket = 'cgs-games.appspot.com',
    [string]$AlertEmail = 'david@finoldigital.com',
    [switch]$SkipFoundation,
    [string]$ExistingImage
)
$ErrorActionPreference = 'Stop'
if ($SourceProject -eq $BackupProject) { throw 'Production and backup projects must differ.' }

function Invoke-Gcloud {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $output = & gcloud @Arguments --quiet
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed: $($Arguments[0..1] -join ' ')" }
    return $output
}

function Ensure-ServiceAccount([string]$Name) {
    $email = "$Name@$BackupProject.iam.gserviceaccount.com"
    $accounts = Invoke-Gcloud iam service-accounts list --project=$BackupProject --format=json | ConvertFrom-Json
    if ($email -notin $accounts.email) {
        Invoke-Gcloud iam service-accounts create $Name --project=$BackupProject --display-name=$Name | Out-Null
    }
    return $email
}

function Invoke-CloudApi([string]$Uri, [string]$Method = 'GET', $Body) {
    $accessToken = Invoke-Gcloud auth print-access-token
    $options = @{ Uri = $Uri; Method = $Method; Headers = @{ Authorization = "Bearer $accessToken"; 'x-goog-user-project' = $BackupProject } }
    if ($null -ne $Body) {
        $options.ContentType = 'application/json'
        $options.Body = $Body | ConvertTo-Json -Depth 30 -Compress
    }
    Invoke-RestMethod @options
}

$outputDirectory = Join-Path $PSScriptRoot '../../.firebase/backups'
New-Item -ItemType Directory -Force $outputDirectory | Out-Null
$worker = "firebase-backup@$BackupProject.iam.gserviceaccount.com"
$monitor = "backup-monitor@$BackupProject.iam.gserviceaccount.com"
$verifier = "backup-verifier@$BackupProject.iam.gserviceaccount.com"
$scheduler = "backup-scheduler@$BackupProject.iam.gserviceaccount.com"
$builder = "backup-builder@$BackupProject.iam.gserviceaccount.com"
$buckets = Invoke-Gcloud storage buckets list --project=$BackupProject --format=json | ConvertFrom-Json
$exportLifecycle = Join-Path $outputDirectory 'export-lifecycle.json'
@{ rule = @(@{ action = @{ type = 'Delete' }; condition = @{ age = 7 } }) } | ConvertTo-Json -Depth 10 | Set-Content $exportLifecycle
if (-not $SkipFoundation) {
Invoke-Gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com cloudscheduler.googleapis.com logging.googleapis.com monitoring.googleapis.com storage.googleapis.com iam.googleapis.com identitytoolkit.googleapis.com firestore.googleapis.com firebaserules.googleapis.com cloudresourcemanager.googleapis.com --project=$BackupProject | Out-Null

$worker = Ensure-ServiceAccount 'firebase-backup'
$monitor = Ensure-ServiceAccount 'backup-monitor'
$verifier = Ensure-ServiceAccount 'backup-verifier'
$scheduler = Ensure-ServiceAccount 'backup-scheduler'
$builder = Ensure-ServiceAccount 'backup-builder'
$sourceNumber = Invoke-Gcloud projects describe $SourceProject '--format=value(projectNumber)'
$backupNumber = Invoke-Gcloud projects describe $BackupProject '--format=value(projectNumber)'
$buckets = Invoke-Gcloud storage buckets list --project=$BackupProject --format=json | ConvertFrom-Json
foreach ($bucket in @($ArchiveBucket, $ExportBucket)) {
    if ($bucket -notin $buckets.name) {
        Invoke-Gcloud storage buckets create "gs://$bucket" --project=$BackupProject --location=US --uniform-bucket-level-access --public-access-prevention | Out-Null
    }
}

# Leave retention unlocked until a successful restore and explicit approval of the irreversible lock.
Invoke-Gcloud storage buckets update "gs://$ArchiveBucket" --retention-period=90d --soft-delete-duration=7d | Out-Null
$archiveLifecycle = Join-Path $outputDirectory 'archive-lifecycle.json'
# Runs are cleaned up after 95 days. Game files under objects/ are shared by every run in a
# 30-day period (OBJECT_PERIOD_DAYS in backup.mjs), so they must outlive the last run that
# references them: 95 + 30 = 125 days, plus 5 days for a run that finishes after its period ends,
# whole-day age rounding, and lifecycle processing delay. Keep the objects/ rule at least 35 days
# longer than the run rule.
@{ rule = @(
    @{ action = @{ type = 'Delete' }; condition = @{ age = 95; matchesPrefix = @('runs/', 'completed/', 'verified/') } },
    @{ action = @{ type = 'Delete' }; condition = @{ age = 130; matchesPrefix = @('objects/') } }
) } | ConvertTo-Json -Depth 10 | Set-Content $archiveLifecycle
Invoke-Gcloud storage buckets update "gs://$ArchiveBucket" --lifecycle-file=$archiveLifecycle | Out-Null
$exportLifecycle = Join-Path $outputDirectory 'export-lifecycle.json'
@{ rule = @(@{ action = @{ type = 'Delete' }; condition = @{ age = 7 } }) } | ConvertTo-Json -Depth 10 | Set-Content $exportLifecycle
Invoke-Gcloud storage buckets update "gs://$ExportBucket" --lifecycle-file=$exportLifecycle | Out-Null

# Only the Firestore service agent can manage temporary exports. It has NO archive access.
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$ExportBucket" "--member=serviceAccount:service-$sourceNumber@gcp-sa-firestore.iam.gserviceaccount.com" --role=roles/storage.admin | Out-Null
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$ExportBucket" "--member=serviceAccount:$worker" --role=roles/storage.objectViewer | Out-Null
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$ArchiveBucket" "--member=serviceAccount:$worker" --role=roles/storage.objectCreator | Out-Null
# The worker lists object names and checksums to reuse already archived game files. It still
# cannot read, replace, or delete archive contents.
$listerRoleFile = Join-Path $outputDirectory 'archive-lister-role.json'
@{ title = 'Backup archive lister'; stage = 'GA'; description = 'List archive object metadata without reading contents.'; includedPermissions = @('storage.objects.list') } | ConvertTo-Json -Depth 5 | Set-Content $listerRoleFile
$existingBackupRoles = Invoke-Gcloud iam roles list --project=$BackupProject --format=json | ConvertFrom-Json
$listerRole = "projects/$BackupProject/roles/backupArchiveLister"
$listerAction = if ($listerRole -in $existingBackupRoles.name) { 'update' } else { 'create' }
Invoke-Gcloud iam roles $listerAction backupArchiveLister --project=$BackupProject --file=$listerRoleFile | Out-Null
if ($listerAction -eq 'create') { Start-Sleep -Seconds 15 }
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$ArchiveBucket" "--member=serviceAccount:$worker" --role=$listerRole | Out-Null
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$ArchiveBucket" "--member=serviceAccount:$monitor" --role=roles/storage.objectViewer | Out-Null
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$ArchiveBucket" "--member=serviceAccount:$verifier" --role=roles/storage.objectViewer | Out-Null
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$ArchiveBucket" "--member=serviceAccount:$verifier" --role=roles/storage.objectCreator | Out-Null
# Create the backup project's Firestore service agent before granting import access.
Invoke-CloudApi "https://serviceusage.googleapis.com/v1beta1/projects/$backupNumber/services/firestore.googleapis.com:generateServiceIdentity" POST @{} | Out-Null
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$ArchiveBucket" "--member=serviceAccount:service-$backupNumber@gcp-sa-firestore.iam.gserviceaccount.com" --role=roles/storage.objectViewer | Out-Null
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$SourceBucket" "--member=serviceAccount:$worker" --role=roles/storage.objectViewer | Out-Null

$roleFile = Join-Path $outputDirectory 'source-reader-role.json'
@{
    title = 'Firebase backup export reader'; stage = 'GA'; description = 'Export data and read recovery configuration without changing production data.'
    includedPermissions = @(
        'datastore.databases.export', 'datastore.databases.getMetadata', 'datastore.operations.get',
        'datastore.indexes.list', 'datastore.indexes.get',
        'firebaseauth.configs.get', 'firebaseauth.configs.getHashConfig', 'firebaseauth.configs.getSecret', 'firebaseauth.users.get',
        'firebaserules.releases.get', 'firebaserules.releases.list', 'firebaserules.rulesets.get',
        'resourcemanager.projects.get', 'resourcemanager.projects.getIamPolicy'
    )
} | ConvertTo-Json -Depth 10 | Set-Content $roleFile
$roles = Invoke-Gcloud iam roles list --project=$SourceProject --format=json | ConvertFrom-Json
$roleName = "projects/$SourceProject/roles/firebaseBackupReader"
$roleAction = if ($roleName -in $roles.name) { 'update' } else { 'create' }
Invoke-Gcloud iam roles $roleAction firebaseBackupReader --project=$SourceProject --file=$roleFile | Out-Null
Invoke-Gcloud projects add-iam-policy-binding $SourceProject "--member=serviceAccount:$worker" --role=$roleName --condition=None | Out-Null
$bucketRoleFile = Join-Path $outputDirectory 'bucket-reader-role.json'
@{ title = 'Backup bucket configuration reader'; stage = 'GA'; includedPermissions = @('storage.buckets.get', 'storage.buckets.getIamPolicy') } | ConvertTo-Json -Depth 5 | Set-Content $bucketRoleFile
$bucketRole = "projects/$SourceProject/roles/backupBucketReader"
$bucketRoleAction = if ($bucketRole -in $roles.name) { 'update' } else { 'create' }
Invoke-Gcloud iam roles $bucketRoleAction backupBucketReader --project=$SourceProject --file=$bucketRoleFile | Out-Null
if ($bucketRoleAction -eq 'create') { Start-Sleep -Seconds 15 }
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$SourceBucket" "--member=serviceAccount:$worker" --role=$bucketRole | Out-Null
}

if (-not $ExistingImage) {
$repos = Invoke-Gcloud artifacts repositories list --project=$BackupProject --location=$Region --format=json | ConvertFrom-Json
if (-not ($repos.name -match '/repositories/backups$')) {
    Invoke-Gcloud artifacts repositories create backups --project=$BackupProject --location=$Region --repository-format=docker | Out-Null
}
Invoke-Gcloud projects add-iam-policy-binding $BackupProject "--member=serviceAccount:$builder" --role=roles/logging.logWriter --condition=None | Out-Null
Invoke-Gcloud artifacts repositories add-iam-policy-binding backups --project=$BackupProject --location=$Region "--member=serviceAccount:$builder" --role=roles/artifactregistry.writer | Out-Null
$buildBucket = "$BackupProject-build-source"
if ($buildBucket -notin $buckets.name) {
    Invoke-Gcloud storage buckets create "gs://$buildBucket" --project=$BackupProject --location=US --uniform-bucket-level-access --public-access-prevention | Out-Null
}
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$buildBucket" "--member=serviceAccount:$builder" --role=roles/storage.objectViewer | Out-Null
Invoke-Gcloud storage buckets update "gs://$buildBucket" --lifecycle-file=$exportLifecycle | Out-Null
$image = "$Region-docker.pkg.dev/$BackupProject/backups/firebase:$(Get-Date -Format 'yyyyMMddHHmmss')"
$buildConfig = Join-Path $outputDirectory 'build.json'
@{
    steps = @(@{ name = 'gcr.io/cloud-builders/docker'; args = @('build', '-t', $image, '.') })
    images = @($image); options = @{ logging = 'CLOUD_LOGGING_ONLY' }
} | ConvertTo-Json -Depth 10 | Set-Content $buildConfig
Invoke-Gcloud builds submit $PSScriptRoot --project=$BackupProject --config=$buildConfig "--service-account=projects/$BackupProject/serviceAccounts/$builder" "--gcs-source-staging-dir=gs://$buildBucket/source" | Out-Null
$imageInfo = Invoke-Gcloud artifacts docker images describe $image --project=$BackupProject --format=json | ConvertFrom-Json
$imageDigest = "$Region-docker.pkg.dev/$BackupProject/backups/firebase@$($imageInfo.image_summary.digest)"
} else {
    if ($ExistingImage -notmatch '@sha256:[a-f0-9]{64}$') { throw 'ExistingImage must be pinned by digest.' }
    $imageDigest = $ExistingImage
}
$restoreBucket = "$BackupProject-restore-test"
if ($restoreBucket -notin $buckets.name) {
    Invoke-Gcloud storage buckets create "gs://$restoreBucket" --project=$BackupProject --location=US --uniform-bucket-level-access --public-access-prevention | Out-Null
}
$restoreLifecycle = Join-Path $outputDirectory 'restore-lifecycle.json'
@{ rule = @(@{ action = @{ type = 'Delete' }; condition = @{ age = 1 } }) } | ConvertTo-Json -Depth 10 | Set-Content $restoreLifecycle
Invoke-Gcloud storage buckets update "gs://$restoreBucket" --lifecycle-file=$restoreLifecycle --soft-delete-duration=0 | Out-Null
Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$restoreBucket" "--member=serviceAccount:$verifier" --role=roles/storage.objectCreator | Out-Null
$restoreRoleFile = Join-Path $outputDirectory 'restore-role.json'
@{ title = 'Backup restore drill'; stage = 'GA'; includedPermissions = @('datastore.databases.create', 'datastore.databases.delete', 'datastore.databases.import', 'datastore.databases.getMetadata', 'datastore.operations.get', 'datastore.entities.get', 'datastore.entities.list', 'storage.buckets.get') } | ConvertTo-Json -Depth 5 | Set-Content $restoreRoleFile
$backupRoles = Invoke-Gcloud iam roles list --project=$BackupProject --format=json | ConvertFrom-Json
$restoreRole = "projects/$BackupProject/roles/backupRestoreDrill"
$restoreAction = if ($restoreRole -in $backupRoles.name) { 'update' } else { 'create' }
Invoke-Gcloud iam roles $restoreAction backupRestoreDrill --project=$BackupProject --file=$restoreRoleFile | Out-Null
if ($restoreAction -eq 'create') { Start-Sleep -Seconds 15 }
Invoke-Gcloud projects add-iam-policy-binding $BackupProject "--member=serviceAccount:$verifier" --role=$restoreRole --condition=None | Out-Null
$environmentFile = Join-Path $outputDirectory 'environment.json'
@{ SOURCE_PROJECT = $SourceProject; BACKUP_PROJECT = $BackupProject; ARCHIVE_BUCKET = $ArchiveBucket; EXPORT_BUCKET = $ExportBucket; SOURCE_BUCKETS = $SourceBucket; RESTORE_BUCKET = $restoreBucket; MAX_BACKUP_AGE_HOURS = '30'; SOURCE_EXCLUDE_PREFIXES = 'staged-uploads/' } | ConvertTo-Json | Set-Content $environmentFile
Invoke-Gcloud run jobs deploy firebase-backup --project=$BackupProject --region=$Region --image=$imageDigest --service-account=$worker --tasks=1 --parallelism=1 --max-retries=1 --task-timeout=14400s --memory=512Mi --cpu=1 --env-vars-file=$environmentFile | Out-Null
Invoke-Gcloud run jobs deploy backup-monitor --project=$BackupProject --region=$Region --image=$imageDigest --service-account=$monitor --tasks=1 --parallelism=1 --max-retries=1 --task-timeout=600s --memory=512Mi --cpu=1 --env-vars-file=$environmentFile '--args=--check' | Out-Null
Invoke-Gcloud run jobs deploy backup-restore-check --project=$BackupProject --region=$Region --image=$imageDigest --service-account=$verifier --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=14400s --memory=512Mi --cpu=1 --env-vars-file=$environmentFile '--args=--verify' | Out-Null
foreach ($job in @('firebase-backup', 'backup-monitor', 'backup-restore-check')) {
    Invoke-Gcloud run jobs add-iam-policy-binding $job --project=$BackupProject --region=$Region "--member=serviceAccount:$scheduler" --role=roles/run.invoker | Out-Null
}
$schedules = Invoke-Gcloud scheduler jobs list --project=$BackupProject --location=$Region --format=json | ConvertFrom-Json
foreach ($entry in @(@{ name = 'firebase-backup'; cron = '0 3 * * *' }, @{ name = 'backup-monitor'; cron = '15 * * * *' }, @{ name = 'backup-restore-check'; cron = '0 8 1 * *' })) {
    $jobName = $entry.name
    $action = if ($schedules.name -contains "projects/$BackupProject/locations/$Region/jobs/$jobName") { 'update' } else { 'create' }
    Invoke-Gcloud scheduler jobs $action http $jobName --project=$BackupProject --location=$Region "--schedule=$($entry.cron)" --time-zone=America/Chicago "--uri=https://run.googleapis.com/v2/projects/$BackupProject/locations/$Region/jobs/${jobName}:run" --http-method=POST "--oauth-service-account-email=$scheduler" --message-body='{}' --attempt-deadline=180s | Out-Null
}

$monitoringRoot = "https://monitoring.googleapis.com/v3/projects/$BackupProject"
$channels = Invoke-CloudApi "$monitoringRoot/notificationChannels"
$channel = $channels.notificationChannels | Where-Object { $_.type -eq 'email' -and $_.labels.email_address -eq $AlertEmail } | Select-Object -First 1
if (-not $channel) {
    $channel = Invoke-CloudApi "$monitoringRoot/notificationChannels" POST @{ type = 'email'; displayName = 'CGS backup alerts'; labels = @{ email_address = $AlertEmail } }
}
$loggingRoot = "https://logging.googleapis.com/v2/projects/$BackupProject"
$metric = @{ name = 'backup_health_checks'; description = 'Successful independent backup freshness checks'; filter = 'resource.type="cloud_run_job" AND jsonPayload.event="backup_health_checked"' }
$metrics = Invoke-CloudApi "$loggingRoot/metrics"
if ($metric.name -notin $metrics.metrics.name) { Invoke-CloudApi "$loggingRoot/metrics" POST $metric | Out-Null }
$policies = @(
    @{
        displayName = 'CGS backup protection changed'; combiner = 'OR'; enabled = $true; notificationChannels = @($channel.name)
        conditions = @(@{ displayName = 'Backup access retention or schedules changed'; conditionMatchedLog = @{ filter = 'log_id("cloudaudit.googleapis.com/activity") AND (protoPayload.methodName:"SetIamPolicy" OR protoPayload.methodName:"setIamPolicy" OR protoPayload.methodName:"setIamPermissions" OR protoPayload.methodName="storage.buckets.update" OR protoPayload.methodName:"DeleteJob" OR protoPayload.methodName:"UpdateJob" OR protoPayload.methodName:"PauseJob" OR protoPayload.methodName:"DeleteProject" OR protoPayload.methodName:"DisableServiceAccount")' } })
        alertStrategy = @{ notificationRateLimit = @{ period = '3600s' }; autoClose = '604800s' }
        documentation = @{ mimeType = 'text/markdown'; content = 'An administrative change affected backup access, bucket configuration, jobs, or schedules. Verify it was authorized. The initial retention lock and future deployments are expected changes.' }
    },
    @{
        displayName = 'CGS backup failed or stale'; combiner = 'OR'; enabled = $true; notificationChannels = @($channel.name)
        conditions = @(@{ displayName = 'Backup or monitor reported failure'; conditionMatchedLog = @{ filter = 'resource.type="cloud_run_job" AND (jsonPayload.event="backup_failed" OR jsonPayload.event="backup_stale")' } })
        alertStrategy = @{ notificationRateLimit = @{ period = '3600s' }; autoClose = '604800s' }
        documentation = @{ mimeType = 'text/markdown'; content = 'A backup or freshness check failed. Inspect Cloud Run Jobs in cgs-games-backups and the latest completed/ archive marker. Follow scripts/backups/README.md. Do not treat a started job as a completed backup.' }
    },
    @{
        displayName = 'CGS backup monitoring stopped'; combiner = 'OR'; enabled = $true; notificationChannels = @($channel.name)
        conditions = @(@{ displayName = 'No healthy freshness check for three hours'; conditionAbsent = @{ filter = 'resource.type="cloud_run_job" AND metric.type="logging.googleapis.com/user/backup_health_checks"'; duration = '10800s'; aggregations = @(@{ alignmentPeriod = '3600s'; perSeriesAligner = 'ALIGN_SUM'; crossSeriesReducer = 'REDUCE_SUM' }); trigger = @{ count = 1 } } })
        alertStrategy = @{ autoClose = '604800s' }
    }
)
$existingPolicies = Invoke-CloudApi "$monitoringRoot/alertPolicies"
foreach ($policy in $policies) {
    $existing = $existingPolicies.alertPolicies | Where-Object displayName -eq $policy.displayName | Select-Object -First 1
    for ($attempt = 0; ; $attempt++) {
        try {
            if ($existing) {
                $policy.name = $existing.name
                Invoke-CloudApi "https://monitoring.googleapis.com/v3/$($existing.name)" PATCH $policy | Out-Null
            } else { Invoke-CloudApi "$monitoringRoot/alertPolicies" POST $policy | Out-Null }
            break
        } catch {
            # New log-based metric descriptors can take up to ten minutes to reach Monitoring.
            if ($policy.displayName -ne 'CGS backup monitoring stopped' -or [int]$_.Exception.Response.StatusCode -ne 404 -or $attempt -ge 20) { throw }
            Start-Sleep -Seconds 30
        }
    }
}
Write-Output "Deployed $imageDigest. Run firebase-backup and verify a restore before locking $ArchiveBucket retention."
