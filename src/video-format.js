// The input is our upright canvas recording, never the original phone file.
export function portraitMp4Args(input, output, quality = 720) {
  const width=quality===1080?1080:720;
  const height=quality===1080?1920:1280;
  return ['-noautorotate','-i',input,'-map','0:v:0','-map','0:a:0?',
    '-vf',`scale=${width}:${height},setsar=1`,
    '-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p',
    '-aspect','9:16','-metadata:s:v:0','rotate=0','-map_metadata','-1',
    '-c:a','aac','-b:a','128k','-movflags','+faststart',output];
}
