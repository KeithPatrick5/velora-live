import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('intro MP4 supports browser byte-range requests', async (t) => {
  const port = 3217;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => child.kill('SIGTERM'));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 4000);
    child.stdout.on('data', chunk => {
      if (String(chunk).includes('Velora running')) { clearTimeout(timer); resolve(); }
    });
    child.once('error', reject);
    child.once('exit', code => { if (code) reject(new Error(`server exited ${code}`)); });
  });

  const response = await fetch(`http://127.0.0.1:${port}/media/velora-site-intro.mp4`, {
    headers: { Range: 'bytes=0-1023' }
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
  assert.match(response.headers.get('content-range') || '', /^bytes 0-1023\/\d+$/);
  assert.equal(Number(response.headers.get('content-length')), 1024);
  assert.equal((await response.arrayBuffer()).byteLength, 1024);
});
