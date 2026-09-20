import { readFileSync } from 'node:fs';
import { withWorkerConfigDefaults } from '../../src/workerConfig.js';
import { probeModelConnection } from '../../src/modelConnectionProbe.js';

const mode = process.argv[2] || 'direct';
if (!['direct', 'worker'].includes(mode)) throw new Error('Unknown probe mode');
// Only scalar uppercase config values are needed. Never print env or provider bodies.
const vars = Object.fromEntries([...readFileSync('wrangler.toml', 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/gm)].map(match => [match[1], match[2]]));
const env = withWorkerConfigDefaults({ ...vars, ANTHROPIC_API_KEY: process.env.AI_PROVIDER_API_KEY });
if (mode === 'direct' && !env.ANTHROPIC_API_KEY || mode === 'worker' && !process.env.TEST_TRIGGER_SECRET) throw new Error('Required probe credential is missing');
const emit = console.log.bind(console);
// The existing client logs provider error bodies. Keep those out of CI output.
console.log = console.warn = console.error = () => {};
let failed = false;
for (const route of ['primary', 'backup', 'primary-stream', 'backup-stream']) {
    let result;
    if (mode === 'direct') result = await probeModelConnection(env, route);
    else {
        try {
            const response = await fetch(`https://cloudflare-ai-lnsight-daily.sabrinamisan090.workers.dev/testModelConnection?route=${route}`, {
                method: 'POST', headers: { 'x-test-trigger-secret': process.env.TEST_TRIGGER_SECRET }, signal: AbortSignal.timeout(55000), redirect: 'error',
            });
            const body = await response.json();
            result = { route, status: response.status, ok: response.ok && body.ok === true,
                requestedModel: body.requestedModel, milliseconds: body.milliseconds };
        } catch { result = { route, ok: false, error: 'worker_probe_failed' }; }
    }
    emit(JSON.stringify(result));
    failed ||= !result.ok;
}
process.exitCode = failed ? 1 : 0;
