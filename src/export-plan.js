export const FPS = 25;
export const INTRO = 0.6;
export const encodeVideo = ['-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-r','25','-video_track_timescale','12800','-threads','1','-an'];
export function overlayTimeline(cues, duration) {
  const frames = Math.ceil(duration * FPS);
  const cuts = new Set([0, frames, Math.min(frames, Math.ceil(4.5 * FPS))]);
  for (const cue of cues) for (const t of [cue.start,cue.end]) cuts.add(Math.max(0,Math.min(frames,Math.ceil(t * FPS))));
  const sorted = [...cuts].sort((a,b)=>a-b);
  return sorted.slice(0,-1).map((start,i)=>({time:start/FPS,duration:(sorted[i+1]-start)/FPS}));
}
export function bodyArgs(input, overlay, output, quality, duration) {
  const w = quality === 1080 ? 1080 : 720, h = w * 16 / 9;
  const pictureH = Math.round(1775 * w / 1080 / 2) * 2;
  return ['-filter_complex_threads','1','-i',input,'-f','concat','-safe','0','-i',overlay,
    '-filter_complex',`[0:v:0]setpts=PTS-STARTPTS,fps=25,scale=${w}:${pictureH}:force_original_aspect_ratio=increase,crop=${w}:${pictureH},setsar=1,pad=${w}:${h}:0:0:color=0x101820[v];[v][1:v]overlay=0:0:eof_action=repeat:format=auto,format=yuv420p[out]`,
    '-map','[out]','-t',String(duration),...encodeVideo,output];
}
export function cardArgs(image, output, duration) {
  return ['-filter_threads','1','-loop','1','-framerate','25','-i',image,'-vf','setsar=1','-t',String(duration),...encodeVideo,output];
}
export function muxArgs({list,input,music,volume,hasAudio,total,output}) {
  const args=['-f','concat','-safe','0','-i',list];
  if(hasAudio) args.push('-i',input);
  else args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
  let filter=`[1:a:0]asetpts=PTS-STARTPTS,aresample=48000,adelay=600:all=1,apad,atrim=duration=${total}[voice]`;
  if(music) {
    args.push('-stream_loop','-1','-i',music);
    filter+=`;[2:a:0]volume=${volume/100},aresample=48000[bg];[voice][bg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=0[a]`;
  } else filter+=';[voice]anull[a]';
  return [...args,'-filter_complex_threads','1','-filter_complex',filter,'-map','0:v:0','-map','[a]',
    '-c:v','copy','-c:a','aac','-b:a','128k','-ac','2','-t',String(total),'-map_metadata','-1','-metadata:s:v:0','rotate=0','-movflags','+faststart',output];
}
