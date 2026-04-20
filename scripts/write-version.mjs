import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const versionPath = path.join(publicDir, 'version.json');

const version = process.env.VITE_APP_VERSION || 'BUILD_HASH_PLACEHOLDER';

await mkdir(publicDir, { recursive: true });
await writeFile(
  versionPath,
  `${JSON.stringify({ version }, null, 2)}\n`,
  'utf8',
);
