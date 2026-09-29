import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startMusic} from './src/music.js';
function fixture(play) {
  const music = new EventTarget();
  Object.assign(music, {play, pause(){this.paused=true;}, removeAttribute(){delete this.src;}, load(){}});
  return {music, gain:{gain:{value:0}}, volume:7.5, timeoutMs:10};
}
test('zero skips loading and playback', async()=>{
  const f=fixture(()=>{throw Error('must not play');}); f.volume=0;
  assert.equal(await startMusic(f),''); assert.equal(f.music.src,undefined);
});
test('valid music starts with selected volume', async()=>{
  const f=fixture(()=>Promise.resolve());
  assert.equal(await startMusic(f),''); assert.equal(f.gain.gain.value,.075);
});
test('failed, stalled and synchronously rejected music allow export', async()=>{
  for(const play of [()=>Promise.reject(Error('decode')),()=>new Promise(()=>{}),()=>{throw Error('blocked');}]){
    const f=fixture(play);
    assert.match(await startMusic(f),/audio original/);
    assert.equal(f.gain.gain.value,0); assert.equal(f.music.paused,true); assert.equal(f.music.src,undefined);
  }
});
