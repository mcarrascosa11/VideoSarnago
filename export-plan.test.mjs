import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overlayTimeline,muxArgs,bodyArgs} from './src/export-plan.js';
test('timeline covers every frame, including subtitle gaps and name removal',()=>{
 const parts=overlayTimeline([{start:.12,end:1.01,text:'A'},{start:2,end:3,text:'B'}],6);
 assert.equal(parts[0].time,0);assert.ok(parts.some(p=>p.time===4.52));
 assert.equal(Math.round(parts.reduce((s,p)=>s+p.duration,0)*25),150);
 for(let i=1;i<parts.length;i++)assert.ok(Math.abs(parts[i-1].time+parts[i-1].duration-parts[i].time)<1e-8);
});
test('render uses original decoded frames and copy-only final video mux',()=>{
 assert.ok(bodyArgs('original','overlay','body',720,10).join(' ').includes('fps=25'));
 const args=muxArgs({list:'list',input:'original',music:null,volume:0,hasAudio:true,total:15,output:'out'});
 assert.equal(args[args.indexOf('-c:v')+1],'copy');
 assert.match(args.join(' '),/adelay=600/);
});
import {videoLayout} from './src/layout.js';
test('orientation follows decoded dimensions and selects matching output sizes',()=>{
 assert.deepEqual(videoLayout({videoWidth:1920,videoHeight:1080},720),{orientation:'landscape',width:1280,height:720});
 assert.deepEqual(videoLayout({videoWidth:1080,videoHeight:1920}),{orientation:'portrait',width:1080,height:1920});
 assert.equal(videoLayout({videoWidth:1080,videoHeight:1080}).orientation,'portrait');
});
test('horizontal preserves the full input while portrait keeps existing crop',()=>{
 const horizontal=bodyArgs('source','overlay','body',1080,10,'landscape').join(' ');
 assert.match(horizontal,/scale=1920:950:force_original_aspect_ratio=decrease/);
 assert.doesNotMatch(horizontal,/crop=/);assert.match(horizontal,/pad=1920:1080/);
 assert.match(bodyArgs('source','overlay','body',720,10).join(' '),/scale=720:1184:force_original_aspect_ratio=increase,crop=720:1184/);
});
import {trimRange,trimCues} from './src/trim.js';
test('trim rejects invalid ranges and defaults to complete video',()=>{
 assert.deepEqual(trimRange(10),{start:0,end:10,duration:10});
 for(const [start,end] of [[5,5],[6,2],[-1,5],[0,11],[NaN,5]])assert.throws(()=>trimRange(10,start,end));
});
test('trim clips boundary subtitles, removes excluded cues and preserves original timestamps',()=>{
 const cues=[{start:0,end:1,text:'excluded'},{start:1,end:4,text:'start'},{start:4,end:8,text:'end'},{start:8,end:9,text:'excluded'}];
 const original=structuredClone(cues);
 assert.deepEqual(trimCues(cues,2,6),[{start:0,end:2,text:'start'},{start:2,end:4,text:'end'}]);
 assert.deepEqual(cues,original);
});
test('trim seeks original video and cuts voice before adding intro delay',()=>{
 const body=bodyArgs('original','overlays','body',720,4,'landscape',2);
 assert.ok(body.indexOf('-ss')<body.indexOf('-i'));assert.equal(body[body.indexOf('-ss')+1],'2');
 const mux=muxArgs({list:'list',input:'original',hasAudio:true,total:6.6,output:'out',trimStart:2,trimDuration:4});
 assert.match(mux.join(' '),/atrim=start=2:duration=4,asetpts=PTS-STARTPTS,aresample=48000,adelay=600/);
});
