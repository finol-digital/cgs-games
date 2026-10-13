# Firebase backups and recovery

CGS Games uses three separate data stores: Firestore, Firebase Authentication, and Cloud Storage. Recovering the service requires all three, plus its application configuration. The backup jobs run in `cgs-games-backups`, independently of the website in `cgs-games`.

## Protection and schedule

| Protection                | Configuration                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firestore recovery        | PITR enabled, seven-day history; database deletion protection enabled                                                                                    |
| Managed Firestore backups | Daily, retained for 14 weeks                                                                                                                             |
| Production game files     | 30-day soft delete on `cgs-games.appspot.com`                                                                                                            |
| Independent backup        | `firebase-backup`, daily at 3 AM America/Chicago                                                                                                         |
| Freshness check           | `backup-monitor`, hourly at 15 minutes past the hour                                                                                                     |
| Automated restore drill   | `backup-restore-check`, first of each month at 8 AM America/Chicago                                                                                      |
| Archive                   | `gs://cgs-games-backups-archive`, 90-day retention; lifecycle cleanup after 95 days                                                                      |
| Temporary exports         | `gs://cgs-games-backups-exports`, cleanup after seven days                                                                                               |
| Restore test files        | `gs://cgs-games-backups-restore-test`, cleanup after one day                                                                                             |
| Alerts                    | `david@finoldigital.com`: job failure, complete backup older than 30 hours, restore check older than 35 days, or no healthy hourly check for three hours |

Daily backups target approximately 24 hours of data loss if production becomes inaccessible. The 30-hour alarm allows time for a daily run to finish. Firestore PITR offers finer recovery when production remains accessible. None of these settings recovers changes made before the first available backup, or guarantees a single transactionally consistent snapshot across Auth, Firestore, and Storage.

The freshness monitor also alerts on a greater-than-30% decline in accounts, exported document counts (when present), or total file bytes compared with the preceding completed backup. Small baselines are excluded. A separate policy reports administrative changes to backup access, buckets, jobs, and schedules. Initial deployment and the retention lock can produce expected notifications.

Bucket retention and an irreversible retention **lock** are distinct settings. Check `retentionPolicy.isLocked` in the Storage JSON API (or `retention_policy.isLocked` in gcloud output) before describing the archive as immutable. Do not shorten or replace retention settings during an incident.

The archive's 90-day retention was permanently locked with owner approval and verified through the Storage API at `2026-10-13T04:18:38Z` (`isLocked: true`, `retentionPeriod: 7776000`). It cannot be reduced or removed. Each new object receives its own 90-day retention window.

## What each complete backup contains

- Every Firestore collection group, including subcollections, exported from a whole-minute PITR timestamp.
- Raw Auth records, original user IDs, provider associations, custom claims, available password hashes and MFA fields. Auth configuration includes the sensitive password hash parameters and provider configuration exposed by the API.
- Every live object in the configured game-files bucket, copied by exact source generation and checked for matching size and CRC32C. Each daily backup is a separate full copy. Deletions in production do not delete earlier archives.
- Deployed Firebase rules, Firestore index and field configuration, database settings, bucket settings, and project and bucket IAM policies.
- Object manifests containing original paths and metadata, and a final `manifest.json` with artifact SHA-256 hashes.

The job writes `completed/<run>.json` only after all stages finish. A directory under `runs/` without a matching completion marker is incomplete. Never restore an incomplete run just because it has some files in it.

The backup rejects unavailable password hash configuration, incomplete exports, copy checksum mismatches, repeated pagination tokens, and enabled Auth multi-tenancy (which requires extending this implementation). New databases or application buckets must be added deliberately; the deployed scope is the default database and `cgs-games.appspot.com`. Build caches, previous manual backup buckets, and temporary hosting artifacts are not application data and are outside this job's scope.

Source-file overwrites or deletions during a backup can cause that attempt to fail. Cloud Run retries the whole job once into a new archive prefix. Cloud Storage soft delete retains recent deleted objects in production, but this daily job does not export soft-deleted objects or every intermediate version between runs.

## Access boundaries

The worker uses its Cloud Run service identity, without a production private key. Its custom production role permits exports and configuration reads; game-file access is read-only. On the archive, it can create objects but cannot read, replace, delete, or change retention. The production Firestore service agent can manage only the temporary export bucket and has no archive access.

The monitor can read the archive. The restore verifier can read it and create verification reports, copy files to the test bucket, and manage test databases in the backup project. It has no production permissions. The scheduler can invoke only the three jobs. The build identity can build images and write build logs, but cannot access the archive.

The same human owner and Google organization still administer both projects. This protects against compromised production workload credentials; it does not establish independence from a compromised owner or organization administrator. Protect administrator accounts with hardware-backed MFA and maintain a separately controlled recovery administrator. For that broader threat, add an archive outside this Google organization with independent credentials and billing. Do not grant production deployment accounts roles in the backup project.

## Deployment and maintenance

The projects must already exist with billing enabled. Sign in as an administrator, then deploy from the repository root:

```powershell
gcloud auth login david@finoldigital.com
./scripts/backups/deploy.ps1
```

The deployment script provisions private buckets, service identities, scoped permissions, a small Node container pinned by image digest, jobs, schedules, and alerts. It uses only the backup directory as its build context; `.env` and application credentials are never uploaded. `-SkipFoundation` and `-ExistingImage <digest-pinned-image>` allow a partially completed deployment to resume after inspecting existing resources.

Production baseline commands, for reference:

```powershell
gcloud firestore databases update --project=cgs-games --database='(default)' --enable-pitr --delete-protection
gcloud firestore backups schedules list --project=cgs-games --database='(default)'
# Create only if a daily schedule does not already exist:
gcloud firestore backups schedules create --project=cgs-games --database='(default)' --recurrence=daily --retention=14w
gcloud storage buckets update gs://cgs-games.appspot.com --soft-delete-duration=30d
```

Run the first backup, restore drill, and monitor in that order. Wait for each execution to succeed:

```powershell
gcloud run jobs execute firebase-backup --project=cgs-games-backups --region=us-central1 --wait
gcloud run jobs execute backup-restore-check --project=cgs-games-backups --region=us-central1 --wait
gcloud run jobs execute backup-monitor --project=cgs-games-backups --region=us-central1 --wait
```

After confirming the archive, restoring it, and explicitly accepting that retention cannot be reduced or removed, an administrator can lock it:

```powershell
gcloud storage buckets update gs://cgs-games-backups-archive --lock-retention-period
```

Full daily file copies currently amplify stored file data by approximately 95 times, plus soft-deleted storage and database exports. Monitor storage growth and billing as the game library grows. The daily job has a four-hour execution limit and 512 MiB memory; reassess these limits if large object manifests approach memory capacity.

Run `npm run test:backups` for backup and restore failure-path tests. The main CI workflow runs these alongside the application tests. Runtime changes require redeploying this separate job; an application deployment does not update it.

## Recovery procedure

1. Contain the incident and revoke compromised access. Preserve evidence. Choose a completed backup from **before** corruption began, even if it is older than the newest backup.
2. Use a clean recovery project and a trusted administrator. Inspect the archived rules, IAM, provider settings, and application commit before restoring them; a backup could contain malicious configuration from an already compromised system.
3. Copy the selected run into restricted recovery storage or an ignored local directory such as `.firebase/recovery`. The Auth exports contain personal data and sensitive hash configuration. Do not put them in Git, shared documents, chat messages, or logs.
4. Create a Firestore database in a compatible location. Grant its Firestore service agent read access to the selected export. For the REST import API, use the parent directory of `manifest.firestore.metadata` as `inputUriPrefix` (`gs://<archive>/<directory>`), preserving the export directory and file basenames. The calling identity also needs `storage.buckets.get` and object read access. Recreate indexes, field overrides/TTL settings, and rules from reviewed configuration; exports do not replace those deployment steps.
5. Restore file objects using `storage-manifests/<bucket>.json` to map each archive object to its original name. Restore reviewed content types and custom metadata. The archive objects intentionally have private cache settings and no Firebase download tokens; source metadata is retained in the manifest. Update database URLs if recovering into a different bucket, and decide whether old download tokens should be rotated.
6. Initialize Firebase Authentication in an **empty** recovery project. Restore the account records using the helper below. It preserves original IDs and defaults to disabling restored users. Reconfigure reviewed sign-in providers and domains separately. Do not reuse compromised OAuth secrets or service-account keys.
7. Validate user IDs against Firestore profiles and game ownership; load games and assets; exercise uploads and access controls; then perform an end-to-end sign-in using a designated test account. Resolve differences caused by the separate capture times of the three services.
8. Rotate affected secrets, revoke sessions as appropriate, deploy the reviewed application and rules, and switch traffic only after those checks pass. Record the selected backup, gaps, and measured recovery time.

Example Auth recovery, replacing the run and target with reviewed values:

```powershell
./scripts/backups/restore-auth.ps1 -Run '<completed-run>' -TargetProject '<clean-recovery-project>'
```

The helper rejects `cgs-games` as a target and refuses a target with existing accounts. `-EnableUsers` preserves their original enabled/disabled state and should only be used for an intended recovery. `-TestOnly` is restricted to `cgs-games-backups`: it imports accounts as disabled, reads back and verifies every original UID, then removes only those test accounts. It does not send email or restore existing login sessions.

## Restore checks and their limits

Initial verification on October 12, 2026 (October 13 UTC) completed two full backups. The latest contained 1,480 Firestore documents, 364 Auth accounts, and 701 files totaling 401,215,250 bytes. A real Auth import preserved all 364 user IDs with accounts disabled, followed by cleanup. The automated drill restored all 701 files, imported the entire Firestore export, and queried 64 games, 262 users, and 262 usernames before deleting its temporary database. The remaining Firestore documents include other collection groups covered by the full export.

The independent monitor subsequently passed for that backup and restore report, and its health metric reached Cloud Monitoring. All three schedules and alert policies were enabled, and no active test databases or Auth accounts remained. The owner confirmed receipt of alert emails at `david@finoldigital.com`. Application validation passed: 412 Jest tests, 14 backup tests, lint, and the production build.

The Git history bundle is archived at `repository/2026-10-12/cgs-games.bundle`; recovery scripts and result summaries are under `recovery-tools/2026-10-12/` in the archive bucket. The deployed image digest is recorded in `final-image.txt` there. These are initial snapshots; maintain the repository and redeploy the backup jobs when their implementation changes.

The monthly job verifies every JSON artifact checksum and Auth identity count, copies all archived game files into a private test bucket, imports the Firestore export into a uniquely named `drill-*` database, and queries users, usernames, and games. It deletes only the database it created, after success, and writes `verified/<drill>.json`. Failed databases remain for investigation; remove them after resolving the failure to avoid accumulating cost.

This automated check does not enable real sign-in providers, import Auth accounts, or cut application traffic over. Repeat the Auth import test and the end-to-end application checks above periodically and after authentication or schema changes. Confirm alert delivery with Cloud Monitoring's notification-channel test and maintain a human owner for investigating incidents.

Keep an independent copy of the Git repository and recovery guide. Secret Manager values and third-party credentials need a separate secure recovery or rotation procedure; the worker intentionally does not copy production service-account private keys. This job is not a complete backup of every Google Cloud service.

References: [Firestore recovery](https://firebase.google.com/docs/firestore/disaster-recovery), [Firestore exports](https://firebase.google.com/docs/firestore/manage-data/export-import), [Auth account import](https://cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/batchCreate), [Storage soft delete](https://cloud.google.com/storage/docs/soft-delete), [Bucket Lock](https://cloud.google.com/storage/docs/bucket-lock).
