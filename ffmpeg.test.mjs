import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execWatched} from './src/ffmpeg.js';
function fake(exec) {
  const handlers = new Set();
  return {multithreaded: true, terminated: false, on: (_, h) => handlers.add(h), off: (_, h) => handlers.delete(h), emit: () => handlers.forEach(h => h({})), handlers,
    exec, terminate() {this.terminated = true;}};
}
test('a silent FFmpeg run is terminated and reported as a stall', async () => {
  const ff = fake(() => new Promise(() => {}));
  await assert.rejects(execWatched(ff, [], {stallMs: 50}), e => e.stalled && e.multithreaded);
  assert.ok(ff.terminated); assert.equal(ff.handlers.size, 0);
});
test('a run that keeps logging is not interrupted and returns its exit code', async () => {
  const ff = fake(() => new Promise(resolve => {let n = 0; const i = setInterval(() => {ff.emit(); if (++n === 30) {clearInterval(i); resolve(0);}}, 100);}));
  assert.equal(await execWatched(ff, [], {stallMs: 2500}), 0);
  assert.ok(!ff.terminated); assert.equal(ff.handlers.size, 0);
});
