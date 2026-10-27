/** @jest-environment node */

const { execFileSync } = require('node:child_process');

describe('Firebase rules-testing dependencies', () => {
  it('initializes Firestore and Storage clients with a shared Firebase app registry', () => {
    const env = { ...process.env };
    delete env.FIREBASE_EMULATOR_HUB;

    // Exercise the native ESM imports used by the emulator suites, outside Jest.
    // Client construction is local; no rules uploads or service requests are made.
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

          const projectId = 'demo-cgs-dependency-tests';
          const environment = await initializeTestEnvironment({
            projectId,
            firestore: { host: '127.0.0.1', port: 8188 },
            storage: { host: '127.0.0.1', port: 9199 },
          });
          try {
            const context = environment.authenticatedContext('alice');
            assert.equal(context.firestore().app.options.projectId, projectId);
            assert.equal(context.storage().app.options.projectId, projectId);
            console.log('Firebase clients initialized');
          } finally {
            await environment.cleanup();
          }
        `,
      ],
      { encoding: 'utf8', env, timeout: 30000 },
    );

    expect(output).toContain('Firebase clients initialized');
  });
});
