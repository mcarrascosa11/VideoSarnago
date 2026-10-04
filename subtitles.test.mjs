import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shortCues,normalizeWhisper,parseSrt,toSrt} from './src/subtitles.js';
import {trimCues} from './src/trim.js';
test('long captions keep every word and their full timing with at most five words per block',()=>{
 const cue={start:2,end:14,text:'No pretendiendo como algunos pretenden un poco románticamente e ingenuamente dar vida a los pueblos porque están muertos'};
 const original=structuredClone(cue),parts=shortCues([cue]);
 assert.ok(parts.every(c=>c.text.split(/\s+/).length<=5&&c.end>c.start));
 assert.equal(parts.map(c=>c.text).join(' '),cue.text);assert.equal(parts[0].start,2);assert.equal(parts.at(-1).end,14);
 for(let i=1;i<parts.length;i++)assert.equal(parts[i].start,parts[i-1].end);
 assert.deepEqual(cue,original);assert.deepEqual(shortCues(parts),parts);
});
test('import, Whisper segments and trimmed SRTs share the five word limit',()=>{
 const text='uno dos tres cuatro cinco seis siete ocho nueve diez once doce';
 const whisper=normalizeWhisper([{text,timestamp:[0,6]}],6);
 assert.ok(whisper.every(c=>c.text.split(/\s+/).length<=5));
 const parts=shortCues(parseSrt('1\n00:00:00,000 --> 00:00:06,000\n'+text));
 const trimmed=parseSrt(toSrt(shortCues(trimCues(parts,1,5))));
 assert.ok(trimmed.every(c=>c.text.split(/\s+/).length<=5&&c.start>=0&&c.end<=4));
 assert.deepEqual(shortCues([{start:0,end:2,text:'  una   frase corta  '}]),[{start:0,end:2,text:'una frase corta'}]);
});
