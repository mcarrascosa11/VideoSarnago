import './styles.css';
import QRCode from 'qrcode';
import {makeCanvas, drawScaled, paintCover, paintFrame, paintOutro, canvasPng} from './visuals.js';
import {parseSrt, toSrt, needsReview} from './subtitles.js';
import {automaticSubtitles, convertToMp4} from './transcribe.js';
import {recordReel} from './media.js';

const $ = id => document.getElementById(id);
const state = {file:null, photo:null, logo:null, qrImage:null, cues:[], mode:'cover', busy:false};
const video = $('previewVideo');
const frameVideo = $('frameVideo');
let sourceUrl, resultUrl, qrVersion = 0;
const settings = ['campaignUrl','outroSecs','renderQuality','language','musicVolume'];
try { const saved = JSON.parse(localStorage.getItem('sarnago-settings') || '{}'); settings.forEach(k => {if (saved[k] !== undefined) $(k).value = saved[k];}); } catch {}
function status(message, pct) {
  $('progressBox').hidden = false;
  $('progressText').textContent = message;
  $('progressPct').textContent = Number.isFinite(pct) ? Math.round(pct) + '%' : '';
  $('progressFill').style.width = (Number.isFinite(pct) ? pct : 0) + '%';
}
function controls() {
  document.querySelectorAll('button,input,select,textarea').forEach(el => el.disabled = state.busy);
  for (const id of ['autoBtn','captureBtn','renderBtn']) $(id).disabled = state.busy || !state.file;
  for (const id of ['coverDownload','gridDownload']) $(id).disabled = state.busy || !state.photo;
}
async function task(fn) {
  if (state.busy) return;
  state.busy = true; controls();
  try { await fn(); } catch (e) { status(e.message || 'No se pudo completar la operación.'); }
  finally {state.busy = false; controls();}
}
function props() {return {...state, name:$('personName').value, role:$('personRole').value, shortUrl:$('campaignUrl').value.trim().replace(/^https?:\/\//,''), video, time:video.currentTime};}
function preview() {
  drawScaled($('previewCanvas'), state.mode === 'outro' ? paintOutro : state.mode === 'live' ? paintFrame : paintCover, props());
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function loadImage(url) {return new Promise((resolve,reject) => {const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('No se pudo leer la imagen.')); img.src = url;});}
async function fileImage(file) {const url = URL.createObjectURL(file); try{return await loadImage(url);} finally{URL.revokeObjectURL(url);}}
async function capture(source = video) {
  if (source.readyState < 2) throw new Error('Espera a que cargue el vídeo.');
  const c = makeCanvas(source.videoWidth,source.videoHeight); c.getContext('2d').drawImage(source,0,0);
  state.photo = await loadImage(c.toDataURL('image/png')); $('coverLabel').textContent = 'Fotograma del vídeo'; preview();
}
$('videoInput').onchange = () => task(async () => {
  const file = $('videoInput').files[0]; if (!file) return;
  video.pause(); if(sourceUrl) URL.revokeObjectURL(sourceUrl);
  state.file = null; state.cues = []; renderCues(); $('downloadVideo').hidden = true;
  sourceUrl = URL.createObjectURL(file);
  await new Promise((resolve,reject) => {video.onloadeddata = resolve; video.onerror = () => reject(new Error('No se puede leer este vídeo. Utiliza MP4 H.264.')); video.src = sourceUrl; video.load();});
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('La duración del vídeo no es válida.');
  frameVideo.src=sourceUrl; frameVideo.load(); $('framePicker').hidden=false; $('frameTime').max=Math.max(0,video.duration-.05); $('frameTime').value=0;
  state.file = file; $('videoLabel').textContent = file.name; await capture(); status('Vídeo preparado.');
});
$('captureBtn').onclick = () => task(async () => {
  frameVideo.pause();
  if (frameVideo.seeking) await new Promise((resolve, reject) => {const timer=setTimeout(()=>reject(new Error('No se pudo cargar ese fotograma. Selecciona otro instante.')),10000);frameVideo.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});});
  await capture(frameVideo); state.mode='cover'; preview(); status('Portada actualizada con el fotograma seleccionado.');
});
$('frameTime').oninput = () => {frameVideo.pause();frameVideo.currentTime=Number($('frameTime').value);};
frameVideo.addEventListener('timeupdate',()=>{$('frameTime').value=frameVideo.currentTime;$('framePosition').textContent=frameVideo.currentTime.toFixed(2)+' s';});
$('coverInput').onchange = () => task(async () => {const f=$('coverInput').files[0]; if(f){state.photo=await fileImage(f); $('coverLabel').textContent=f.name; preview();}});
$('logoInput').onchange = () => task(async () => {const f=$('logoInput').files[0]; if(f){state.logo=await fileImage(f); $('logoLabel').textContent=f.name; preview();}});
async function updateQr() {
  const version = ++qrVersion, value=$('campaignUrl').value.trim(); state.qrImage=null; preview();
  if (!value) return;
  try {const url=new URL(value); if (!['https:','http:'].includes(url.protocol)) throw Error();
    const img=await loadImage(await QRCode.toDataURL(url.href,{width:600,margin:4,errorCorrectionLevel:'M'}));
    if(version===qrVersion){state.qrImage=img;preview();}
  } catch {status('Introduce un enlace completo válido para generar el QR.');}
}
function updateMusicLabel(){ $('musicVolumeValue').textContent = `${Number($('musicVolume').value).toLocaleString('es-ES',{maximumFractionDigits:1})}%`; }
for(const id of settings) $(id).addEventListener('change',()=>{try{localStorage.setItem('sarnago-settings',JSON.stringify(Object.fromEntries(settings.map(k=>[k,$(k).value]))));}catch{} if(id==='campaignUrl') updateQr(); if(id==='musicVolume') updateMusicLabel();});
updateMusicLabel();
for(const id of ['personName','personRole']) $(id).addEventListener('input',preview);
for(const [id,mode] of [['showCover','cover'],['showOutro','outro'],['showLive','live']]) $(id).onclick=()=>{state.mode=mode; document.querySelectorAll('.preview-switch button').forEach(b=>b.classList.toggle('selected',b.id===id)); video.classList.toggle('hidden',mode!=='live'); if(mode!=='live')video.pause(); preview();};
video.addEventListener('timeupdate',preview); video.addEventListener('seeked',preview);
function renderCues() {
  $('cues').replaceChildren(); $('cueCount').textContent=state.cues.length;
  state.cues.forEach((cue,i)=>{
    const row=document.createElement('div'); row.className='cue-row'; if(needsReview(cue)){row.classList.add('needs-review');row.title='Revisa esta frase: repetición o demasiado texto para su duración.';}
    for(const key of ['start','end']) {const input=document.createElement('input'); input.type='number';input.min='0';input.step='0.1';input.value=cue[key];input.setAttribute('aria-label',key==='start'?'Inicio en segundos':'Fin en segundos');input.onchange=()=>{cue[key]=Number(input.value);preview();};row.append(input);}
    const text=document.createElement('textarea');text.value=cue.text;text.setAttribute('aria-label','Texto del subtítulo');text.oninput=()=>{cue.text=text.value;preview();};row.append(text);
    const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Eliminar subtítulo');remove.onclick=()=>{state.cues.splice(i,1);renderCues();preview();};row.append(remove);$('cues').append(row);
  });
}
$('addCue').onclick=()=>{const start=video.currentTime||0;state.cues.push({start,end:start+3,text:''});renderCues();};
$('srtInput').onchange=()=>task(async()=>{const f=$('srtInput').files[0];if(!f)return;const cues=parseSrt(await f.text());if(!cues.length)throw new Error('El SRT no contiene subtítulos válidos.');state.cues=cues;renderCues();preview();status('Subtítulos importados.');});
$('exportSrt').onclick=()=>download(new Blob([toSrt(state.cues)],{type:'text/plain;charset=utf-8'}),'sarnago.srt');
$('autoBtn').onclick=()=>task(async()=>{
  video.pause();frameVideo.pause();
  const report=message=>{$('subtitleStatus').textContent=message;};
  try {state.cues=await automaticSubtitles(state.file,$('language').value,video.duration,report);renderCues();preview();const doubtful=state.cues.filter(needsReview).length;report('Subtítulos preparados con Whisper Small. Puedes editar cada frase.'+(doubtful?' Hay '+doubtful+' fragmentos marcados para revisar por repetición o duración.':''));}
  catch(e){report('No se han generado los subtítulos: '+(e?.message || String(e)));throw e;}
});
for(const [id,grid] of [['coverDownload',false],['gridDownload',true]]) $(id).onclick=()=>task(async()=>{await document.fonts.ready;const c=makeCanvas(1080,grid?1350:1920);drawScaled(c,paintCover,props(),grid);download(await canvasPng(c),grid?'sarnago-portada-4x5.png':'sarnago-portada.png');});
$('renderBtn').onclick=()=>task(async()=>{
  if(!$('personName').value.trim()) throw new Error('Escribe el nombre de la persona.');
  await updateQr(); if(!state.qrImage) throw new Error('Introduce el enlace real del crowdfunding antes de exportar.');
  const outro=Number($('outroSecs').value);
  if(!Number.isFinite(outro)||outro<2||outro>12)throw new Error('Revisa la duración del cierre (2–12 s).');
  if(state.cues.some(c=>!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start||c.end>video.duration+.1))throw new Error('Revisa los tiempos de los subtítulos.');
  video.pause();$('downloadVideo').hidden=true;await document.fonts.ready;
  const result=await recordReel({...props(),outro,quality:Number($('renderQuality').value),musicVolume:Number($('musicVolume').value),progress:status});
  const blob=await convertToMp4(result.blob,status,Number($('renderQuality').value));
  if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=URL.createObjectURL(blob);$('downloadVideo').href=resultUrl;$('downloadVideo').download='26CrowdfundingVideo_'+($('personName').value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'').replace(/\s+/g,'_')||'NOMBRE')+'.mp4';$('downloadVideo').hidden=false;status('Vídeo terminado. Ya puedes descargarlo.',100);
});
controls(); preview(); updateQr();document.fonts.ready.then(preview);
