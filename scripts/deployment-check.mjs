import { readFileSync, existsSync } from 'node:fs';

const requiredFiles = ['netlify.toml', 'vercel.json', '.env.example', 'public/_headers', 'public/_redirects'];
for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing deployment file: ${file}`);
}

const netlify = readFileSync('netlify.toml', 'utf8');
const vercel = readFileSync('vercel.json', 'utf8');
const env = readFileSync('.env.example', 'utf8');
const headers = readFileSync('public/_headers', 'utf8');

for (const needle of ['publish = "."', 'command = "npm run check"']) {
  if (!netlify.includes(needle)) throw new Error(`netlify.toml missing: ${needle}`);
}
for (const needle of ['"outputDirectory": "."', '"TERPN_BACKEND_ENABLED"']) {
  if (!vercel.includes(needle)) throw new Error(`vercel.json missing: ${needle}`);
}
for (const needle of ['TERPN_BACKEND_ENABLED=false', 'TERPN_AUTH_SESSION_ENABLED=false']) {
  if (!env.includes(needle)) throw new Error(`.env.example missing safe default: ${needle}`);
}
for (const needle of ['X-Content-Type-Options', 'Permissions-Policy']) {
  if (!headers.includes(needle)) throw new Error(`public/_headers missing security header: ${needle}`);
}

console.log('Deployment checks passed');
