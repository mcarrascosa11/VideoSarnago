import {makeCanvas, drawScaled, paintCover, paintOutro, paintOverlay, canvasPng} from './visuals.js';
import {getFfmpeg} from './transcribe.js';
import {INTRO, FPS, overlayTimeline, bodyArgs, cardArgs, muxArgs} from './export-plan.js';

export async function exportReel(props) {
  const {file, video, quality, outro, progress} = props;
  const duration = video.duration;
  if (!file || !Number.isFinite(duration) || duration <= 0) throw new Error('El vídeo no tiene una duración válida.');
  const bodyDuration = Math.ceil(duration * FPS) / FPS;
  const endDuration = Math.ceil(outro * FPS) / FPS;
  const total = INTRO + bodyDuration + endDuration;
  const ffmpeg = await getFfmpeg(progress);
  const prefix = 'reel_' + Date.now() + '_';
  const files = [];
  const name = n => prefix + n;
  let warning = '', hasAudio = false, probing = false, stage = '', base = 0, span = 0, length = 1;
  const log = ({message}) => {if (probing && /Stream #0:.*Audio:/.test(message)) hasAudio = true;};
  const onProgress = ({time}) => progress(stage, base + span * Math.min(.99, Math.max(0,time / 1e6 / length)));
  ffmpeg.on('log',log); ffmpeg.on('progress',onProgress);
  async function write(n, data) {const path=name(n);files.push(path);await ffmpeg.writeFile(path,data);return path;}
  async function run(args, text, start, range, seconds) {
    stage=text; base=start; span=range; length=seconds; progress(text,start);
    let timer;
    try {
      const exit=await Promise.race([
        ffmpeg.exec(['-y',...args]),
        new Promise((_,reject)=>{timer=setTimeout(()=>{ffmpeg.terminate();reject(new Error('La exportación ha superado 15 minutos. Tus ajustes siguen aquí; prueba con calidad 720p.'));},900000);}),
      ]);
      if(exit!==0) throw new Error('No se pudo completar: '+text);
    } finally {clearTimeout(timer);}
  }
  const w=quality===1080?1080:720, h=w*16/9;
  const canvas=makeCanvas(w,h);
  async function png(n, painter, data, transparent=false) {
    // Separate alpha canvas: drawScaled intentionally creates an opaque context.
    const c=transparent?makeCanvas(w,h):canvas;
    if(transparent){const ctx=c.getContext('2d');ctx.scale(w/1080,h/1920);painter(ctx,data);}
    else drawScaled(c,painter,data);
    return write(n,new Uint8Array(await (await canvasPng(c)).arrayBuffer()));
  }
  try {
    progress('Leyendo el vídeo original…',1);
    const input=await write('source',new Uint8Array(await file.arrayBuffer()));
    const cover=await png('cover.png',paintCover,props);
    const end=await png('end.png',paintOutro,props);
    const segments=overlayTimeline(props.cues||[],bodyDuration);
    let list='ffconcat version 1.0\n', last;
    for(let i=0;i<segments.length;i++) {
      const segment=segments[i];
      last=await png(`overlay_${i}.png`,paintOverlay,{...props,time:segment.time},true);
      list+=`file '${last}'\nduration ${segment.duration.toFixed(6)}\n`;
      progress('Preparando subtítulos y diseño…',2+Math.round(6*i/segments.length));
    }
    list+=`file '${last}'\n`;
    const overlay=await write('overlays.ffconcat',new TextEncoder().encode(list));
    const body=name('body.mp4');files.push(body);
    probing=true;
    await run(bodyArgs(input,overlay,body,quality,bodyDuration),'Procesando fotogramas del original…',8,70,bodyDuration);
    probing=false;
    const intro=name('intro.mp4'), ending=name('ending.mp4');files.push(intro,ending);
    await run(cardArgs(cover,intro,INTRO),'Integrando portada…',78,2,INTRO);
    await run(cardArgs(end,ending,endDuration),'Integrando cierre y QR…',80,8,endDuration);
    const concat=await write('clips.ffconcat',new TextEncoder().encode(`ffconcat version 1.0\nfile '${intro}'\nfile '${body}'\nfile '${ending}'\n`));
    const output=name('final.mp4');files.push(output);
    const volume=Math.max(0,Math.min(20,Number(props.musicVolume)||0));
    let music;
    if(volume>0) {
      try {
        const response=await fetch('/music/first-light-particles-v2.mp3',{signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw new Error('Music unavailable');
        music=await write('music.mp3',new Uint8Array(await response.arrayBuffer()));
      } catch {warning='No se pudo cargar la música; se conserva la voz original.';}
    }
    const mix=()=>run(muxArgs({list:concat,input,music,volume,hasAudio,total,output}),'Preparando audio y MP4 final…',88,11,total);
    try {await mix();} catch(e) {
      if(!music || !ffmpeg.loaded)throw e;
      music=null;warning='La música falló; se conserva la voz original.';await mix();
    }
    const bytes=await ffmpeg.readFile(output);
    if(!bytes.length)throw new Error('El MP4 está vacío.');
    return {blob:new Blob([bytes],{type:'video/mp4'}),musicWarning:warning};
  } finally {
    ffmpeg.off('log',log);ffmpeg.off('progress',onProgress);
    if(ffmpeg.loaded)for(const path of files)try{await ffmpeg.deleteFile(path);}catch{}
  }
}
