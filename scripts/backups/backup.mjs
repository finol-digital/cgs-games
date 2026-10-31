import { randomUUID, createHash } from 'node:crypto';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const storage = 'https://storage.googleapis.com/storage/v1';
const encode = encodeURIComponent;

// Game files are archived once per period under objects/p<period>/ and reused by every run in
// that period, instead of being copied in full every day. The archive lifecycle must keep
// objects/ for at least OBJECT_PERIOD_DAYS longer than the run retention (see deploy.ps1), so
// every object a run references outlives the run itself.
export const OBJECT_PERIOD_DAYS = 30;

export function objectPeriod(date) {
  return Math.floor(date.getTime() / (OBJECT_PERIOD_DAYS * 86400000));
}

export function configuration(env) {
  const required = [
    'SOURCE_PROJECT',
    'BACKUP_PROJECT',
    'ARCHIVE_BUCKET',
    'EXPORT_BUCKET',
    'SOURCE_BUCKETS',
  ];
  for (const key of required) if (!env[key]) throw new Error(`Missing ${key}`);
  const config = {
    source: env.SOURCE_PROJECT,
    project: env.BACKUP_PROJECT,
    archive: env.ARCHIVE_BUCKET,
    staging: env.EXPORT_BUCKET,
    buckets: env.SOURCE_BUCKETS.split(',').map((value) => value.trim()),
    database: env.DATABASE_ID || '(default)',
    maxAgeHours: Number(env.MAX_BACKUP_AGE_HOURS || 30),
    restoreBucket: env.RESTORE_BUCKET,
    // Transient, user-controlled uploads that the application deletes after processing.
    excludePrefixes: (env.SOURCE_EXCLUDE_PREFIXES ?? 'staged-uploads/')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
  if (config.source === config.project) throw new Error('Backups must use a separate project');
  if (
    config.archive === config.staging ||
    config.buckets.some((bucket) => !bucket || [config.archive, config.staging].includes(bucket))
  ) {
    throw new Error('Source, staging and archive buckets must be distinct');
  }
  if (!Number.isFinite(config.maxAgeHours) || config.maxAgeHours <= 0)
    throw new Error('Invalid backup age');
  return config;
}

// Runtime identity comes from Cloud Run. No production key or .env file is loaded.
export function cloudApi(fetcher = globalThis.fetch) {
  let cached;
  return async function api(url, { method = 'GET', body, raw = false } = {}) {
    if (!cached || cached.expiresAt < Date.now() + 60000) {
      const response = await fetcher(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        {
          headers: { 'Metadata-Flavor': 'Google' },
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok) throw new Error('Unable to obtain workload identity');
      const token = await response.json();
      cached = { token: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    }
    for (let attempt = 0; ; attempt++) {
      const response = await fetcher(url, {
        method,
        headers: { Authorization: `Bearer ${cached.token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }),
        signal: AbortSignal.timeout(120000),
      });
      if (response.ok) return response.status === 204 ? {} : response.json();
      if (method === 'GET' && [429, 500, 502, 503, 504].includes(response.status) && attempt < 4) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      // Never include response bodies, object paths, tokens, or account data in logs.
      throw new Error(`Cloud API ${method} ${new URL(url).hostname} returned ${response.status}`);
    }
  };
}

export async function* pages(api, endpoint, field, tokenParameter = 'pageToken') {
  let token;
  const seen = new Set();
  do {
    const url = new URL(endpoint);
    if (token) url.searchParams.set(tokenParameter, token);
    const response = await api(url.toString());
    yield response[field] || [];
    token = response.nextPageToken;
    if (token && seen.has(token)) throw new Error('Repeated pagination token');
    seen.add(token);
  } while (token);
}

export async function collect(api, endpoint, field) {
  const result = [];
  for await (const page of pages(api, endpoint, field)) result.push(...page);
  return result;
}

export function snapshotTime(now, earliestVersionTime) {
  const timestamp = Math.floor((now.getTime() - 120000) / 60000) * 60000;
  if (timestamp < Date.parse(earliestVersionTime))
    throw new Error('PITR history is not ready; retry later');
  return new Date(timestamp).toISOString();
}

async function saveJson(api, bucket, name, value) {
  const body = JSON.stringify(value);
  const result = await api(
    `https://storage.googleapis.com/upload/storage/v1/b/${encode(bucket)}/o?uploadType=media&ifGenerationMatch=0&name=${encode(name)}`,
    {
      method: 'POST',
      body,
      raw: true,
    },
  );
  return {
    name,
    generation: result.generation,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
}

export async function copyObject(api, sourceBucket, object, destinationBucket, destinationName) {
  let token;
  let response;
  do {
    const url = new URL(
      `${storage}/b/${encode(sourceBucket)}/o/${encode(object.name)}/rewriteTo/b/${encode(destinationBucket)}/o/${encode(destinationName)}`,
    );
    // Pin the source generation when known so backups and restores copy exactly the recorded version.
    if (object.generation) url.searchParams.set('sourceGeneration', object.generation);
    url.searchParams.set('ifGenerationMatch', '0');
    if (token) url.searchParams.set('rewriteToken', token);
    response = await api(url.toString(), {
      method: 'POST',
      // Public download tokens/ACLs belong in the protected manifest, not the archive object's metadata.
      body: { metadata: {}, cacheControl: 'private, no-store' },
    });
    token = response.rewriteToken;
    if (!response.done && !token) throw new Error('Incomplete object rewrite');
  } while (!response.done);
  if (response.resource?.size !== object.size || response.resource?.crc32c !== object.crc32c) {
    throw new Error('Copied object checksum or size mismatch');
  }
  return {
    name: destinationName,
    generation: response.resource.generation,
    size: object.size,
    crc32c: object.crc32c,
  };
}

/**
 * Copies every object under sourcePrefix (except excluded prefixes) to `${prefix}<relative name>`.
 * With `existing` (archive objects already listed under prefix, keyed by name), objects are
 * addressed by source generation instead, and an already archived generation is reused rather
 * than copied again.
 */
export async function copyBucket(
  api,
  source,
  destination,
  prefix,
  { sourcePrefix = '', exclude = [], existing } = {},
) {
  const objects = [];
  const endpoint = `${storage}/b/${encode(source)}/o?maxResults=1000&prefix=${encode(sourcePrefix)}`;
  for await (const page of pages(api, endpoint, 'items')) {
    const included = page.filter((object) => !exclude.some((p) => object.name.startsWith(p)));
    // Bounded concurrency keeps memory and API pressure independent of bucket size.
    for (let index = 0; index < included.length; index += 8) {
      const results = await Promise.all(
        included.slice(index, index + 8).map(async (object) => {
          const relative = object.name.slice(sourcePrefix.length);
          if (!existing) {
            return {
              source: object,
              backup: await copyObject(api, source, object, destination, `${prefix}${relative}`),
            };
          }
          const name = `${prefix}${object.generation}/${relative}`;
          const archived = existing.get(name);
          if (!archived) {
            return {
              source: object,
              backup: await copyObject(api, source, object, destination, name),
            };
          }
          // The name pins the source generation, so the content must match exactly.
          if (archived.size !== object.size || archived.crc32c !== object.crc32c) {
            throw new Error('Archived object checksum or size mismatch');
          }
          return {
            source: object,
            backup: {
              name,
              generation: archived.generation,
              size: object.size,
              crc32c: object.crc32c,
              reused: true,
            },
          };
        }),
      );
      objects.push(...results);
    }
  }
  return objects;
}

export async function exportAuth(api, source, save) {
  const root = `https://identitytoolkit.googleapis.com/admin/v2/projects/${encode(source)}`;
  const config = await api(`${root}/config`);
  if (config.multiTenant?.allowTenants)
    throw new Error('Tenant backup must be configured before enabling multi-tenancy');
  if (!config.signIn?.hashConfig?.signerKey)
    throw new Error('Auth hash configuration missing; check getHashConfig permission');
  await save('auth/config.json', config);
  await save('auth/providers.json', {
    defaultSupportedIdps: await collect(
      api,
      `${root}/defaultSupportedIdpConfigs`,
      'defaultSupportedIdpConfigs',
    ),
    oauthIdpConfigs: await collect(api, `${root}/oauthIdpConfigs`, 'oauthIdpConfigs'),
    inboundSamlConfigs: await collect(api, `${root}/inboundSamlConfigs`, 'inboundSamlConfigs'),
  });
  let count = 0;
  let pageNumber = 0;
  for await (const users of pages(
    api,
    `https://identitytoolkit.googleapis.com/v1/projects/${encode(source)}/accounts:batchGet?maxResults=1000`,
    'users',
    'nextPageToken',
  )) {
    if (users.some((user) => user.passwordUpdatedAt && !user.passwordHash)) {
      throw new Error('Password account has no exported hash; recovery requires investigation');
    }
    // Keep raw REST records, including MFA and provider fields omitted by some CLI exports.
    await save(`auth/users-${String(pageNumber++).padStart(6, '0')}.json`, { users });
    count += users.length;
  }
  return { users: count, pages: pageNumber };
}

export async function runBackup(
  config,
  api,
  { now = () => new Date(), pause = sleep, log = () => {} } = {},
) {
  const startedAt = now().toISOString();
  const run = `${startedAt.replace(/[:.]/g, '-')}-${randomUUID()}`;
  const prefix = `runs/${run}/`;
  const manifest = {
    schemaVersion: 1,
    run,
    sourceProject: config.source,
    startedAt,
    artifacts: [],
    storage: [],
  };
  const save = async (name, value) => {
    const artifact = await saveJson(api, config.archive, prefix + name, value);
    manifest.artifacts.push(artifact);
    return artifact;
  };
  const databasePath = `projects/${config.source}/databases/${config.database}`;
  const databaseUrl = `https://firestore.googleapis.com/v1/${databasePath}`;
  const db = await api(databaseUrl);
  if (db.pointInTimeRecoveryEnablement !== 'POINT_IN_TIME_RECOVERY_ENABLED')
    throw new Error('PITR must be enabled');
  manifest.firestoreSnapshotTime = snapshotTime(now(), db.earliestVersionTime);
  await save('configuration/database.json', db);
  await save(
    'configuration/indexes.json',
    await collect(api, `${databaseUrl}/collectionGroups/-/indexes`, 'indexes'),
  );
  await save(
    'configuration/fields.json',
    await collect(
      api,
      `${databaseUrl}/collectionGroups/-/fields?filter=${encode('indexConfig.usesAncestorConfig:false OR ttlConfig:*')}`,
      'fields',
    ),
  );
  await save(
    'configuration/project-iam.json',
    await api(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${config.source}:getIamPolicy`,
      { method: 'POST', body: { options: { requestedPolicyVersion: 3 } } },
    ),
  );
  const releases = await collect(
    api,
    `https://firebaserules.googleapis.com/v1/projects/${config.source}/releases`,
    'releases',
  );
  const rulesets = [];
  for (const release of releases)
    rulesets.push(await api(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`));
  await save('configuration/rules.json', { releases, rulesets });
  manifest.auth = await exportAuth(api, config.source, save);
  log('auth_exported', { users: manifest.auth.users });

  const exportPrefix = `exports/${run}`;
  const operation = await api(`${databaseUrl}:exportDocuments`, {
    method: 'POST',
    body: {
      outputUriPrefix: `gs://${config.staging}/${exportPrefix}`,
      snapshotTime: manifest.firestoreSnapshotTime,
    },
  });
  if (!operation.name?.startsWith(`${databasePath}/operations/`))
    throw new Error('Invalid export operation');
  let result = operation;
  const deadline = Date.now() + 2 * 60 * 60 * 1000;
  while (!result.done) {
    if (Date.now() > deadline) throw new Error('Firestore export exceeded two hours');
    await pause(15000);
    result = await api(`https://firestore.googleapis.com/v1/${operation.name}`);
  }
  if (result.error) throw new Error(`Firestore export failed (${result.error.code})`);
  // Keep the export directory basename: Firestore import requires it to match overall_export_metadata.
  const exported = await copyBucket(
    api,
    config.staging,
    config.archive,
    `${prefix}firestore/${run}/`,
    { sourcePrefix: `${exportPrefix}/` },
  );
  const overall = exported.find((object) =>
    object.backup.name.endsWith('.overall_export_metadata'),
  );
  if (!overall) throw new Error('Firestore export metadata missing');
  manifest.firestore = {
    operation: operation.name,
    metadata: overall.backup.name,
    files: exported.length,
    documentCount: result.metadata?.progressDocuments?.completedWork,
  };
  await save('firestore-manifest.json', exported);
  log('firestore_exported', { files: exported.length });

  for (const bucket of config.buckets) {
    const settings = await api(`${storage}/b/${encode(bucket)}`);
    await save(`configuration/buckets/${bucket}.json`, settings);
    await save(
      `configuration/buckets/${bucket}-iam.json`,
      await api(`${storage}/b/${encode(bucket)}/iam?optionsRequestedPolicyVersion=3`),
    );
    // List-only access to the archive: names and checksums, never object contents.
    const objectPrefix = `objects/p${objectPeriod(new Date(startedAt))}/${bucket}/`;
    const existing = new Map();
    for await (const page of pages(
      api,
      `${storage}/b/${encode(config.archive)}/o?maxResults=1000&prefix=${encode(objectPrefix)}`,
      'items',
    ))
      for (const item of page) existing.set(item.name, item);
    const objects = await copyBucket(api, bucket, config.archive, objectPrefix, {
      exclude: config.excludePrefixes,
      existing,
    });
    await save(`storage-manifests/${bucket}.json`, objects);
    const bytes = objects.reduce((sum, object) => sum + BigInt(object.source.size), 0n).toString();
    const reused = objects.filter((object) => object.backup.reused).length;
    manifest.storage.push({
      bucket,
      objects: objects.length,
      bytes,
      copied: objects.length - reused,
      reused,
      excludedPrefixes: config.excludePrefixes,
    });
    log('storage_exported', { objects: objects.length, bytes, reused });
  }
  manifest.completedAt = now().toISOString();
  const manifestArtifact = await saveJson(api, config.archive, `${prefix}manifest.json`, manifest);
  // This append-only marker is the only signal the monitor accepts as a completed backup.
  await saveJson(api, config.archive, `completed/${run}.json`, {
    ...manifestArtifact,
    run,
    startedAt,
    completedAt: manifest.completedAt,
  });
  log('backup_completed', { run, users: manifest.auth.users, storage: manifest.storage });
  return manifest;
}

export async function checkBackup(config, api, now = new Date()) {
  const completions = await collect(
    api,
    `${storage}/b/${encode(config.archive)}/o?prefix=completed%2F&maxResults=1000`,
    'items',
  );
  const newest = completions.sort(
    (a, b) => Date.parse(b.timeCreated) - Date.parse(a.timeCreated),
  )[0];
  if (!newest) throw new Error('No completed backup exists');
  const marker = await api(
    `${storage}/b/${encode(config.archive)}/o/${encode(newest.name)}?alt=media&generation=${newest.generation}`,
  );
  const ageHours = (now.getTime() - Date.parse(marker.startedAt)) / 3600000;
  if (!Number.isFinite(ageHours) || ageHours < 0 || ageHours > config.maxAgeHours)
    throw new Error('Latest complete backup exceeds the recovery window');
  const manifest = await api(
    `${storage}/b/${encode(config.archive)}/o/${encode(marker.name)}?alt=media&generation=${marker.generation}`,
  );
  if (createHash('sha256').update(JSON.stringify(manifest)).digest('hex') !== marker.sha256)
    throw new Error('Backup manifest checksum mismatch');
  if (completions[1]) {
    const previous = completions[1];
    const previousMarker = await api(
      `${storage}/b/${encode(config.archive)}/o/${encode(previous.name)}?alt=media&generation=${previous.generation}`,
    );
    const previousManifest = await api(
      `${storage}/b/${encode(config.archive)}/o/${encode(previousMarker.name)}?alt=media&generation=${previousMarker.generation}`,
    );
    checkVolume(previousManifest, manifest);
  }
  return { run: marker.run, ageHours };
}

export function checkVolume(previous, current) {
  const totalBytes = (value) =>
    value.storage.reduce((total, bucket) => total + Number(bucket.bytes), 0);
  for (const [before, after, minimum] of [
    [previous.auth.users, current.auth.users, 10],
    [totalBytes(previous), totalBytes(current), 1048576],
    [Number(previous.firestore.documentCount), Number(current.firestore.documentCount), 10],
  ]) {
    if (before >= minimum && after < before * 0.7)
      throw new Error(
        'Backup data volume dropped by more than 30 percent; investigate possible deletion',
      );
  }
}

async function waitOperation(api, operation, pause = sleep) {
  const deadline = Date.now() + 2 * 60 * 60 * 1000;
  // Database deletion can return its terminal response without a `done` field.
  while (!operation.done && !operation.response && !operation.error) {
    if (Date.now() > deadline) throw new Error('Restore operation timed out');
    await pause(15000);
    operation = await api(`https://firestore.googleapis.com/v1/${operation.name}`);
  }
  if (operation.error) throw new Error(`Restore operation failed (${operation.error.code})`);
  return operation;
}

// This drill can only restore into the independently configured backup project.
// Its identity has no production access and cannot delete archive objects.
export async function verifyBackup(config, api, { pause = sleep, now = new Date() } = {}) {
  if (
    config.project === config.source ||
    !config.restoreBucket ||
    [config.archive, config.staging, ...config.buckets].includes(config.restoreBucket)
  ) {
    throw new Error('Restore drill requires an isolated project and test bucket');
  }
  const latest = await checkBackup(config, api, now);
  const prefix = `runs/${latest.run}/`;
  const getJson = (name, generation) =>
    api(
      `${storage}/b/${encode(config.archive)}/o/${encode(name)}?alt=media${generation ? `&generation=${generation}` : ''}`,
    );
  const manifest = await getJson(`${prefix}manifest.json`);
  const authIds = new Set();
  const fileManifests = [];
  for (const artifact of manifest.artifacts) {
    const value = await getJson(artifact.name, artifact.generation);
    if (createHash('sha256').update(JSON.stringify(value)).digest('hex') !== artifact.sha256)
      throw new Error('Recovery artifact checksum mismatch');
    if (artifact.name.includes('/auth/users-')) {
      for (const user of value.users) {
        if (!user.localId || authIds.has(user.localId))
          throw new Error('Missing or duplicate Auth identity');
        authIds.add(user.localId);
      }
    }
    if (artifact.name.includes('/storage-manifests/')) fileManifests.push(value);
  }
  if (authIds.size !== manifest.auth.users) throw new Error('Auth recovery count mismatch');
  const drillId = `drill-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8)}`;
  let objects = 0;
  for (const fileManifest of fileManifests) {
    for (let index = 0; index < fileManifest.length; index += 8) {
      await Promise.all(
        fileManifest
          .slice(index, index + 8)
          .map(({ backup }) =>
            copyObject(
              api,
              config.archive,
              backup,
              config.restoreBucket,
              `${drillId}/${backup.name}`,
            ),
          ),
      );
      objects += fileManifest.slice(index, index + 8).length;
    }
  }
  const expectedObjects = manifest.storage.reduce((total, bucket) => total + bucket.objects, 0);
  if (objects !== expectedObjects) throw new Error('Restored file count does not match the backup');
  const databasePath = `projects/${config.project}/databases/${drillId}`;
  const databaseUrl = `https://firestore.googleapis.com/v1/${databasePath}`;
  const databaseSettings = await getJson(`${prefix}configuration/database.json`);
  await waitOperation(
    api,
    await api(
      `https://firestore.googleapis.com/v1/projects/${config.project}/databases?databaseId=${drillId}`,
      {
        method: 'POST',
        body: { type: 'FIRESTORE_NATIVE', locationId: databaseSettings.locationId },
      },
    ),
    pause,
  );
  const imported = await waitOperation(
    api,
    await api(`${databaseUrl}:importDocuments`, {
      method: 'POST',
      // The REST API requires the export directory, not the metadata filename.
      body: {
        inputUriPrefix: `gs://${config.archive}/${manifest.firestore.metadata.slice(0, manifest.firestore.metadata.lastIndexOf('/'))}`,
      },
    }),
    pause,
  );
  // A successful operation is not enough: the import must restore every exported document.
  const exportedDocuments = Number(manifest.firestore.documentCount);
  const importedDocuments = Number(imported.metadata?.progressDocuments?.completedWork);
  if (Number.isFinite(exportedDocuments)) {
    if (!Number.isFinite(importedDocuments))
      throw new Error('Restore did not report how many documents it imported');
    if (importedDocuments < exportedDocuments)
      throw new Error('Restored fewer documents than the backup exported');
  }
  const counts = {};
  for (const collectionId of ['users', 'usernames', 'games']) {
    const result = await api(`${databaseUrl}/documents:runAggregationQuery`, {
      method: 'POST',
      body: {
        structuredAggregationQuery: {
          structuredQuery: { from: [{ collectionId }] },
          aggregations: [{ alias: 'total', count: {} }],
        },
      },
    });
    const count = result.find((item) => item.result?.aggregateFields?.total)?.result.aggregateFields
      .total;
    if (!count) throw new Error('Restored database could not be queried');
    counts[collectionId] = Number(count.integerValue || 0);
    // The site cannot run without these collections; an empty restore is a failed restore.
    if (!(counts[collectionId] > 0))
      throw new Error(`Restored database has no ${collectionId} documents`);
  }
  // Delete only the uniquely named database created above, and only after its import and reads succeed.
  const restored = await api(databaseUrl);
  await waitOperation(
    api,
    await api(`${databaseUrl}?etag=${encode(restored.etag)}`, { method: 'DELETE' }),
    pause,
  );
  const report = {
    run: latest.run,
    checkedAt: new Date().toISOString(),
    authRecordsValidated: authIds.size,
    filesRestored: objects,
    documentsImported: importedDocuments,
    firestoreCounts: counts,
    deletedTestDatabase: databasePath,
    limitation:
      'Auth records validated; human sign-in and application cutover require a separate drill.',
  };
  await saveJson(api, config.archive, `verified/${drillId}.json`, report);
  return report;
}

export async function checkRestore(config, api, now = new Date()) {
  const reports = await collect(
    api,
    `${storage}/b/${encode(config.archive)}/o?prefix=verified%2F&maxResults=1000`,
    'items',
  );
  const newest = reports.sort((a, b) => Date.parse(b.timeCreated) - Date.parse(a.timeCreated))[0];
  if (!newest || now.getTime() - Date.parse(newest.timeCreated) > 35 * 86400000)
    throw new Error('No successful restore check in the last 35 days');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const log = (event, details = {}, severity = 'INFO') =>
    console.log(JSON.stringify({ severity, event, ...details }));
  const checking = process.argv.includes('--check');
  const verifying = process.argv.includes('--verify');
  try {
    const config = configuration(process.env);
    const api = cloudApi();
    if (checking) {
      const health = await checkBackup(config, api);
      await checkRestore(config, api);
      log('backup_health_checked', health);
    } else if (verifying) log('backup_restore_verified', await verifyBackup(config, api));
    else await runBackup(config, api, { log });
  } catch (error) {
    log(checking ? 'backup_stale' : 'backup_failed', { message: error.message }, 'ERROR');
    process.exitCode = 1;
  }
}
