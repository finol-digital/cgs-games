/** @jest-environment node */
import { GET } from '@/app/api/sandbox/games/route';
import spec from '@/public/openapi.json';
import { readFileSync } from 'node:fs';

describe('developer API contract', () => {
  it('serves deterministic sandbox games matching every required catalog field', async () => {
    const response = await GET();
    const games = await response.json();
    expect(games).toEqual(await (await GET()).json());
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(games).toHaveLength(1);
    for (const property of spec.components.schemas.Game.required) {
      expect(typeof games[0][property]).toBe('string');
    }
    expect(new Date(games[0].uploadedAt).toISOString()).toBe(games[0].uploadedAt);
  });

  it('gives every operation a unique ID, description, version parameter and typed payloads', () => {
    const ids = new Set<string>();
    for (const item of Object.values(spec.paths)) {
      expect(item.parameters).toContainEqual(
        expect.objectContaining({
          name: 'API-Version',
          in: 'header',
          schema: { type: 'string', enum: ['1'], default: '1' },
        }),
      );
      for (const [method, operation] of Object.entries(item)) {
        if (method === 'parameters') continue;
        const op = operation as { operationId: string; description: string };
        expect(op.operationId).toBeTruthy();
        expect(ids.has(op.operationId)).toBe(false);
        ids.add(op.operationId);
        expect(op.description.length).toBeGreaterThan(10);
      }
    }
    // Traverse all schema positions, rejecting untyped {} placeholders while allowing references/unions.
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'schema') {
          expect(child).toEqual(expect.any(Object));
          const schema = child as Record<string, unknown>;
          expect(Boolean(schema.type || schema.$ref || schema.anyOf || schema.oneOf)).toBe(true);
        }
        visit(child);
      }
    };
    visit(spec);
    expect(spec.components.schemas.PublishedGame.properties.success.type).toBe('boolean');
    expect(spec.components.schemas.Game.required).not.toContain('copyright');
    expect(spec.components.schemas.Game.properties.copyright.type).toBe('string');
  });

  it('keeps llms.txt H2 sections as linked file lists with concrete when-to-use guidance', () => {
    const guide = readFileSync('public/llms.txt', 'utf8');
    expect(guide).toContain('## When to use CGS Games');
    expect(guide).toContain('API-Version: 1');
    for (const section of guide.split(/^## .+$/m).slice(1)) {
      for (const line of section
        .trim()
        .split('\n')
        .filter((line) => line.trim())) {
        expect(line).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)]+\)(?:: .+)?\r?$/);
      }
    }
    for (const url of ['/developers', '/about', '/contact', '/api/sandbox/games']) {
      expect(guide).toContain('https://cgs.games' + url);
    }
  });
});
