import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bodyArgs} from './src/export-plan.js';
import {montageBodyArgs,voiceArgs,montageMuxArgs} from './src/montage-plan.js';
test('montage: a clip with another orientation keeps the whole frame with margins',()=>{
 const contain=montageBodyArgs('src','ov','body',720,10,'portrait',0,1,true).join(' ');
 assert.match(contain,/scale=720:1184:force_original_aspect_ratio=decrease,pad=720:1184/);assert.doesNotMatch(contain,/crop=/);
 assert.deepEqual(montageBodyArgs('src','ov','body',720,10,'portrait',2,1,false),bodyArgs('src','ov','body',720,10,'portrait',2,1));
 assert.deepEqual(montageBodyArgs('src','ov','body',720,10,'landscape',0,1,true),bodyArgs('src','ov','body',720,10,'landscape',0,1));
});
test('montage: each voice is cut like its body and padded to the exact duration',()=>{
 const voice=voiceArgs({input:'src',hasAudio:true,start:2.5,duration:7.04,output:'v.wav'});
 assert.ok(voice.indexOf('-ss')<voice.indexOf('-i'));assert.equal(voice[voice.indexOf('-ss')+1],'2.5');
 assert.match(voice.join(' '),/apad,atrim=duration=7.04/);assert.equal(voice[voice.indexOf('-t')+1],'7.04');
 const silent=voiceArgs({input:'src',hasAudio:false,duration:3,output:'v.wav'}).join(' ');
 assert.match(silent,/anullsrc/);assert.doesNotMatch(silent,/ src /);
});
test('montage: final mux copies video, joins voices and keeps every input single-threaded',()=>{
 const count=(args,flag)=>args.filter(a=>a===flag).length;
 const mux=montageMuxArgs({list:'l',voiceList:'vl',music:'m',volume:7.5,total:40,output:'o'});
 assert.equal(mux[mux.indexOf('-c:v')+1],'copy');assert.equal(count(mux,'-i'),3);assert.equal(count(mux,'-threads'),4);
 assert.match(mux.join(' '),/atrim=duration=40\[voice\]/);
 const dry=montageMuxArgs({list:'l',voiceList:'vl',music:null,volume:0,total:12,output:'o'});
 assert.equal(count(dry,'-i'),2);assert.match(dry.join(' '),/\[voice\]anull\[a\]/);
});
import {collageGrid} from './src/montage-cover.js';
test('montage cover: collage grid fits every frame without empty rows',()=>{
 for(const n of [2,3,4,5,6,7,8,9,10,11,12]){const {cols,rows}=collageGrid(n,1080,1115);assert.ok(cols*rows>=n);assert.ok(cols*(rows-1)<n);}
 assert.deepEqual(collageGrid(1,1080,1115),{cols:1,rows:1});
});
