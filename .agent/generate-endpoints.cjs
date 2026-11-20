const fs = require('node:fs');
const path = require('node:path');

const backend = path.resolve(__dirname, '..');
const read = filename => fs.readFileSync(path.join(backend, filename), 'utf8');
const app = read('src/app.ts');
const routeImports = new Map(
  [...app.matchAll(/import (\w+) from '\.\/(routes\/[^']+)';/g)]
    .map(([, identifier, file]) => [identifier, 'src/' + file + '.ts'])
);
const access = {
  authRoutes: 'Registration and login are public and rate-limited. Logout clears the media cookie. Profile-picture requires a bearer session.',
  citizenRoutes: 'Citizen bearer session. Verification rechecks the password and binds a short-lived grant to the current session and IP. Lists and submissions are scoped to the caller.',
  documentRoutes: 'Citizen bearer session. Upload accepts multipart field document and type metadata.',
  consentRoutes: 'Citizen bearer session. Consent controllers enforce ownership.',
  verifierRoutes: 'Verifier or Admin bearer session. Individual routes and controllers enforce narrower role and consent rules.',
  adminRoutes: 'Admin bearer session. Admin decisions atomically apply approved corrections.',
  uploadRoutes: 'Bearer session or scoped media cookie with file owner, authority or prescription consent checks.'
};

const sections = [
  '# SCTN HTTP endpoint inventory',
  '',
  'Generated from Express router registrations by node .agent/generate-endpoints.cjs. Paths are relative to the same host.',
  '',
  '## Platform and frontend',
  '',
  '| Method | Path | Purpose |',
  '| --- | --- | --- |',
  '| GET | /healthz | Public backend and PostgreSQL readiness |',
  '| GET | /assets/* | Production frontend assets |',
  '| GET | /{*route} | SPA fallback after API and upload mounts |',
  ''
];

let count = 3;
for (const [, mount, router] of app.matchAll(/app\.use\('([^']+)', (\w+)\);/g)) {
  const file = routeImports.get(router);
  if (!file) continue;
  const routes = [...read(file).matchAll(/router\.(get|post|put|patch|delete|options|head)\('([^']+)'/g)];
  if (!routes.length) throw new Error('No endpoints found in ' + file);
  sections.push('## ' + mount, '', access[router] ?? 'Check authorization in ' + file + '.', '',
    'Source: [route file](../' + file + ')', '', '| Method | Path |', '| --- | --- |');
  for (const [, method, suffix] of routes) {
    sections.push('| ' + method.toUpperCase() + ' | ' + mount + (suffix === '/' ? '' : suffix) + ' |');
  }
  sections.push('');
  count += routes.length;
}

if (count < 10) throw new Error('The endpoint inventory is unexpectedly short');
const target = path.join(__dirname, 'ENDPOINTS.md');
const contents = sections.join('\n');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== contents) {
    throw new Error('Endpoint inventory is stale. Run node .agent/generate-endpoints.cjs.');
  }
} else {
  fs.writeFileSync(target, contents);
}
console.log(count + ' routes documented.');
