// Bundles a TypeScript entry with rolldown (already installed with Vite) and runs it in Node.
// Usage: node scripts/run-ts.mjs tests/physics.test.ts
import { rolldown } from 'rolldown';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = process.argv[2];
if (!entry) { console.error('usage: node scripts/run-ts.mjs <entry.ts>'); process.exit(2); }
const dir = mkdtempSync(join(tmpdir(), 'cable-test-'));
const file = join(dir, 'out.mjs');
const bundle = await rolldown({ input: resolve(entry), platform: 'node', logLevel: 'silent' });
await bundle.write({ file, format: 'esm' });
await bundle.close();
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
await import(pathToFileURL(file).href);
