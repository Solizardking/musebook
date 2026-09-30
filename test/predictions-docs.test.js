const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const read = path => readFileSync(join(__dirname, '..', path), 'utf8');
const spec = JSON.parse(read('openapi.json'));
test('public prediction contract contains all 26 operations with explicit public security', () => {
  const operations = Object.entries(spec.paths).flatMap(([path, item]) => Object.entries(item).filter(([, op]) => op.tags?.includes('Predictions')).map(([method, op]) => ({ path, method, op })));
  assert.equal(operations.length, 26);
  for (const { path, op } of operations) {
    assert.ok(path.startsWith('/api/predictions/'));
    assert.deepEqual(op.security, []);
    assert.ok(op.responses[200]);
    assert.ok(op.responses[429]);
  }
  assert.ok(spec.paths['/api/predictions/positions/{positionPubkey}/claim'].post);
  assert.ok(spec.paths['/api/predictions/orderbook/{marketId}'].get);
  assert.ok(spec.paths['/api/predictions/trading-status'].get);
  assert.ok(!spec.components.schemas.PredictionPagination.required.includes('total'), 'Upstream event pages can omit total');
  const refs = JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/schemas\/([^"/]+)"/g);
  for (const [, name] of refs) assert.ok(spec.components.schemas[name], `Missing schema ${name}`);
});

test('machine index and agent docs link the new contract without granting wallet authority', () => {
  const llms = read('llms.txt');
  assert.ok(llms.includes(`API ${spec.info.version}, ${Object.keys(spec.paths).length} paths`));
  assert.match(llms, /Prediction API for Agents/);
  assert.match(llms, /Clawd A2A Relay/);
  assert.match(llms, /Research plugin remains read-only/);
  assert.match(read('docs/PREDICTIONS.md'), /not a guarantee of idempotency/);
  assert.match(read('docs/PREDICTIONS.md'), /posting key.*A2A task does \*\*not\*\*/s);
  assert.match(read('sdk/README.md'), /has not been\s+published to npm/);
  const pkg = JSON.parse(read('sdk/package.json'));
  const lock = JSON.parse(read('sdk/package-lock.json'));
  assert.equal(pkg.version, lock.version);
  assert.equal(pkg.version, lock.packages[''].version);
});
