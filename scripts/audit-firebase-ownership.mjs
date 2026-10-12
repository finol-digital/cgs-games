import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import process from 'node:process';
import nextEnv from '@next/env';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { auditStoragePrefixes } from './lib/auditStorage.mjs';

// Read-only production audit. Keep identifiers and deployed rules in ignored local output.
nextEnv.loadEnvConfig(process.cwd());
const credential = cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
});
const app = initializeApp({
  credential,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});
const output = '.firebase/security-audit';
await mkdir(output, { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  project: process.env.FIREBASE_PROJECT_ID,
  checks: {},
  findings: [],
  limitations: [],
};
const finding = (type, details) => report.findings.push({ type, ...details });
const attempt = async (name, operation) => {
  try {
    report.checks[name] = await operation();
  } catch (error) {
    report.limitations.push({
      check: name,
      code: error.code || error.status || 'unavailable',
      message: error.message,
    });
  }
};
try {
  const db = getFirestore(app);
  const [users, usernames, games, collections] = await Promise.all([
    db.collection('users').get(),
    db.collection('usernames').get(),
    db.collection('games').get(),
    db.listCollections(),
  ]);
  const profiles = new Map(users.docs.map((doc) => [doc.id, doc.data()]));
  const registry = new Map(usernames.docs.map((doc) => [doc.id, doc.data().uid]));
  const profileNames = new Map();
  for (const doc of users.docs) {
    const name = doc.data().username;
    if (typeof name !== 'string' || registry.get(name) !== doc.id)
      finding('profile_registry_mismatch', { uid: doc.id, username: name ?? null });
    if (Object.keys(doc.data()).some((key) => key !== 'username'))
      finding('extra_profile_fields', { uid: doc.id, fields: Object.keys(doc.data()) });
    profileNames.set(name, [...(profileNames.get(name) || []), doc.id]);
  }
  for (const [name, ids] of profileNames)
    if (ids.length > 1)
      finding('duplicate_profile_username', { username: name ?? null, uids: ids });
  for (const doc of usernames.docs) {
    const uid = doc.data().uid;
    if (typeof uid !== 'string' || profiles.get(uid)?.username !== doc.id)
      finding('registry_profile_mismatch', { username: doc.id, uid: uid ?? null });
    if (Object.keys(doc.data()).some((key) => key !== 'uid'))
      finding('extra_registry_fields', { username: doc.id, fields: Object.keys(doc.data()) });
  }
  let legacyGames = 0;
  const { prefixes: gamePrefixes, findings: storageFindings } = auditStoragePrefixes(
    games.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    registry,
  );
  report.findings.push(...storageFindings);
  const gameNames = new Set();
  for (const doc of games.docs) {
    const data = doc.data();
    const uid = registry.get(data.username);
    if (!uid || profiles.get(uid)?.username !== data.username)
      finding('game_owner_unresolved', { gameId: doc.id, username: data.username ?? null });
    if (data.ownerUid === undefined) legacyGames++;
    else if (data.ownerUid !== uid) finding('game_owner_uid_mismatch', { gameId: doc.id });
    const key = JSON.stringify([data.username, data.slug]);
    if (gameNames.has(key))
      finding('duplicate_game_route', { gameId: doc.id, username: data.username, slug: data.slug });
    gameNames.add(key);
  }
  report.checks.firestore = {
    users: users.size,
    usernames: usernames.size,
    games: games.size,
    gamesWithoutOwnerUid: legacyGames,
    rootCollections: collections.map((collection) => collection.id),
  };
  const known = new Set(['users', 'usernames', 'games', 'gatcg_ocr_cache', 'gatcg_spoiler_cache']);
  for (const collection of collections) {
    if (!known.has(collection.id)) finding('unclassified_collection', { path: collection.path });
    // Inventory nested namespaces without reading their contents.
    const documents = await collection.listDocuments();
    for (let offset = 0; offset < documents.length; offset += 10) {
      const nested = await Promise.all(
        documents.slice(offset, offset + 10).map((document) => document.listCollections()),
      );
      for (const child of nested.flat()) finding('nested_collection', { path: child.path });
    }
  }
  await attempt('auth', async () => {
    const accounts = new Map();
    let pageToken;
    do {
      const page = await getAuth(app).listUsers(1000, pageToken);
      for (const user of page.users) accounts.set(user.uid, user.disabled);
      pageToken = page.pageToken;
    } while (pageToken);
    for (const uid of profiles.keys())
      if (!accounts.has(uid)) finding('profile_without_auth_account', { uid });
    return { accounts: accounts.size, disabled: [...accounts.values()].filter(Boolean).length };
  });
  for (const kind of ['firestore', 'storage'])
    await attempt(`${kind}Rules`, async () => {
      const rules =
        kind === 'firestore'
          ? await getSecurityRules(app).getFirestoreRuleset()
          : await getSecurityRules(app).getStorageRuleset(
              process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            );
      const source = rules.source.map((file) => file.content).join('\n');
      await writeFile(`${output}/deployed-${kind}.rules`, source);
      const local = await readFile(`${kind}.rules`, 'utf8');
      return {
        createdAt: rules.createTime,
        sha256: createHash('sha256').update(source).digest('hex'),
        matchesLocal:
          source.replaceAll('\r\n', '\n').trim() === local.replaceAll('\r\n', '\n').trim(),
      };
    });
  const bucket = getStorage(app).bucket();
  await attempt('storage', async () => {
    const [metadata] = await bucket.getMetadata();
    const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
    await writeFile(`${output}/bucket-iam.json`, JSON.stringify(policy, null, 2));
    const [files] = await bucket.getFiles({ projection: 'full' });
    const counts = {};
    let orphanedPublished = 0;
    let publicWriteAcls = 0;
    for (const file of files) {
      const top = file.name.split('/')[0];
      counts[top] = (counts[top] || 0) + 1;
      if (top === 'games' && ![...gamePrefixes].some((prefix) => file.name.startsWith(prefix)))
        orphanedPublished++;
      if (top === 'staged-uploads' && !profiles.has(file.name.split('/')[1]))
        finding('staged_object_unknown_owner', { path: file.name });
      for (const acl of file.metadata.acl || [])
        if (['allUsers', 'allAuthenticatedUsers'].includes(acl.entity) && acl.role !== 'READER')
          publicWriteAcls++;
    }
    for (const binding of policy.bindings || [])
      if (
        binding.members?.some((member) => ['allUsers', 'allAuthenticatedUsers'].includes(member)) &&
        ![
          'roles/storage.objectViewer',
          'roles/storage.legacyObjectReader',
          'roles/storage.legacyBucketReader',
        ].includes(binding.role)
      )
        finding('public_bucket_privilege', { role: binding.role });
    return {
      bucket: bucket.name,
      objects: files.length,
      prefixes: counts,
      publishedObjectsWithoutListing: orphanedPublished,
      publicWriteAcls,
      uniformBucketLevelAccess: metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled,
      publicAccessPrevention: metadata.iamConfiguration?.publicAccessPrevention,
      defaultObjectAcl: metadata.defaultObjectAcl?.map(({ entity, role }) => ({ entity, role })),
    };
  });
  const { access_token: token } = await credential.getAccessToken();
  const remote = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Object.assign(
        new Error(`Read-only control-plane request failed (HTTP ${response.status})`),
        { status: response.status },
      );
    return response.json();
  };
  await attempt('projectIam', async () => {
    const policy = await remote(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${report.project}:getIamPolicy`,
      { method: 'POST', body: '{}' },
    );
    await writeFile(`${output}/project-iam.json`, JSON.stringify(policy, null, 2));
    const publicBindings = (policy.bindings || []).filter((binding) =>
      binding.members?.some((member) => ['allUsers', 'allAuthenticatedUsers'].includes(member)),
    );
    for (const binding of publicBindings)
      finding('public_project_privilege', { role: binding.role });
    return {
      bindings: policy.bindings?.length || 0,
      publicBindings: publicBindings.map(({ role }) => role),
    };
  });
  await attempt('databases', () =>
    remote(`https://firestore.googleapis.com/v1/projects/${report.project}/databases`),
  );
  await attempt('realtimeDatabase', () =>
    remote(
      `https://firebasedatabase.googleapis.com/v1beta/projects/${report.project}/locations/-/instances`,
    ),
  );
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  const types = {};
  for (const item of report.findings) types[item.type] = (types[item.type] || 0) + 1;
  console.log(
    JSON.stringify(
      {
        checks: report.checks,
        findingsByType: types,
        limitations: report.limitations,
        localReport: `${output}/report.json`,
      },
      null,
      2,
    ),
  );
} finally {
  await deleteApp(app);
}
