// FFmpeg arguments for montages of several supporter videos (see montage-export.js).
import {bodyArgs} from './export-plan.js';

// Same as bodyArgs, but a clip whose orientation differs from the output keeps the whole frame with margins instead of being cropped.
export function montageBodyArgs(input, overlay, output, quality, duration, orientation, trimStart, threads, contain) {
  const args = bodyArgs(input, overlay, output, quality, duration, orientation, trimStart, threads);
  if (!contain || orientation === 'landscape') return args;
  const i = args.indexOf('-filter_complex');
  args[i + 1] = args[i + 1].replace(/force_original_aspect_ratio=increase,crop=(\d+):(\d+)/, 'force_original_aspect_ratio=decrease,pad=$1:$2:(ow-iw)/2:(oh-ih)/2:color=0x101820');
  return args;
}
// Voice of one clip, cut like its body and padded with silence to exactly `duration`.
export function voiceArgs({input, hasAudio, start = 0, duration, output}) {
  const source = hasAudio
    ? [...(start > 0 ? ['-ss', String(start)] : []), '-threads', '1', '-i', input]
    : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
  return ['-threads', '1', ...source, '-vn', '-filter_threads', '1',
    '-af', `aresample=48000,asetpts=PTS-STARTPTS,apad,atrim=duration=${duration}`,
    '-ac', '2', '-c:a', 'pcm_s16le', '-t', String(duration), output];
}
// Joins the clip bodies + closing (video copy) with the concatenated voices and the music.
export function montageMuxArgs({list, voiceList, music, volume, total, output}) {
  const args = ['-threads', '1', '-f', 'concat', '-safe', '0', '-i', list, '-threads', '1', '-f', 'concat', '-safe', '0', '-i', voiceList];
  let filter = `[1:a:0]asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=duration=${total}[voice]`;
  if (music) {
    args.push('-threads', '1', '-stream_loop', '-1', '-i', music);
    filter += `;[2:a:0]volume=${volume / 100},aresample=48000[bg];[voice][bg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=0[a]`;
  } else filter += ';[voice]anull[a]';
  return [...args, '-filter_complex_threads', '1', '-filter_complex', filter, '-map', '0:v:0', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-threads', '1', '-ac', '2', '-t', String(total), '-map_metadata', '-1', '-metadata:s:v:0', 'rotate=0', '-movflags', '+faststart', output];
}
