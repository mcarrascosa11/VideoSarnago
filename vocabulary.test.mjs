import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixText, fixVocabulary, parseVocabulary, DEFAULT_VOCABULARY} from './src/vocabulary.js';
const words = parseVocabulary(DEFAULT_VOCABULARY);
const fix = t => fixText(t, words);
test('vocabulary: usual mishearings of Sarnago and hacendera are corrected',()=>{
 for (const t of ['Sarnago','sarnago','Sárnago','Zarnago','Sarnaco','Sarnagó','Sar nago','Sarna go','Zárnago'])
  assert.equal(fix(`Vivo en ${t}.`),'Vivo en Sarnago.', t);
 for (const t of ['hacendera','acendera','a cendera','asendera','a sendera','hacenderá','jacendera','ha cendera'])
  assert.equal(fix(`la ${t} de mayo`),'la hacendera de mayo', t);
 assert.equal(fix('Las hacenderas, las asenderas'),'Las hacenderas, las hacenderas');
 assert.equal(fix('Hacendera de octubre'),'Hacendera de octubre');
 assert.equal(fix('¿Vienes a Zarnago?'),'¿Vienes a Sarnago?');
});
test('vocabulary: ordinary Spanish words stay as they are',()=>{
 const text='la hacienda de Santiago en Zaragoza, el sargazo, un perro sarnoso, la tendera encendera la luz, a sus casas ha cenado';
 assert.equal(fix(text),text);
});
test('vocabulary: custom list, proper nouns capitalised, cues keep timings',()=>{
 const custom=parseVocabulary('Sarnago; Tierras Altas, mondidas');
 assert.deepEqual(custom.map(w=>w.word),['Sarnago','mondidas']);
 const cues=[{start:1,end:2,text:'las móndidas de sarnago'}];
 assert.deepEqual(fixVocabulary(cues,'Sarnago, móndidas'),[{start:1,end:2,text:'las móndidas de Sarnago'}]);
 assert.equal(cues[0].text,'las móndidas de sarnago');
});
