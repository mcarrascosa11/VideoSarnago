// Montage cover: a collage with one frame from each supporter video, in the montage order.
import {COLORS, wrapLines} from './visuals.js';

const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = '"DM Sans", Arial, sans-serif';

function line(ctx, y, x1, x2) {ctx.strokeStyle = COLORS.earth; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();}
function cover(ctx, image, x, y, w, h) {
  const iw = image.width, ih = image.height; if (!iw || !ih) return;
  const k = Math.max(w / iw, h / ih), tw = iw * k, th = ih * k;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(image, x + (w - tw) / 2, y + (h - th) / 2, tw, th); ctx.restore();
}
function drawLogo(ctx, logo, x, y, maxW, maxH) {
  if (!logo || !logo.naturalWidth) return;
  const k = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight);
  ctx.drawImage(logo, x, y, logo.naturalWidth * k, logo.naturalHeight * k);
}
// Rows × columns for n frames inside a w × h area, keeping cells close to the frames' shape.
export function collageGrid(n, w, h, cellAspect = 9 / 16) {
  if (n <= 1) return {cols: 1, rows: 1};
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols), aspect = (w / cols) / (h / rows);
    const score = Math.abs(Math.log(aspect / cellAspect)) + (rows * cols - n) * .25;
    if (!best || score < best.score) best = {cols, rows, score};
  }
  return {cols: best.cols, rows: best.rows};
}
// Draws the frames in a grid; the last row stretches to fill the width. Gaps in the brand colour.
export function paintCollage(ctx, frames, x, y, w, h, gap = 6) {
  ctx.fillStyle = COLORS.deep; ctx.fillRect(x, y, w, h);
  const list = frames.filter(Boolean);
  if (!list.length) return;
  const portraitFrames = list.filter(f => f.height >= f.width).length >= list.length / 2;
  const {cols, rows} = collageGrid(list.length, w, h, portraitFrames ? 9 / 16 : 16 / 9);
  const cellH = (h - gap * (rows - 1)) / rows;
  list.forEach((frame, i) => {
    const row = Math.floor(i / cols), inRow = row === rows - 1 ? list.length - cols * (rows - 1) : cols, col = i - row * cols;
    const cellW = (w - gap * (inRow - 1)) / inRow;
    cover(ctx, frame, x + col * (cellW + gap), y + row * (cellH + gap), cellW, cellH);
  });
}

export function paintMontageCover(ctx, props, grid = false) {
  if (!grid && props.orientation === 'landscape') return paintLandscape(ctx, props);
  const H = grid ? 1350 : 1920, cut = grid ? 775 : 1180;
  ctx.save();
  ctx.fillStyle = COLORS.night; ctx.fillRect(0, 0, 1080, H);
  paintCollage(ctx, props.frames || [], 0, 125, 1080, cut + 60 - 125);
  const fade = ctx.createLinearGradient(0, cut - 260, 0, cut + 80);
  fade.addColorStop(0, 'rgba(24,33,43,0)'); fade.addColorStop(.6, 'rgba(24,33,43,.9)'); fade.addColorStop(1, 'rgba(24,33,43,1)');
  ctx.fillStyle = fade; ctx.fillRect(0, cut - 260, 1080, 340);
  ctx.fillStyle = COLORS.night; ctx.fillRect(0, cut + 80, 1080, H - cut - 80);
  // Header, as on the single cover.
  ctx.fillStyle = COLORS.night; ctx.fillRect(0, 0, 1080, 125);
  ctx.textAlign = 'left'; ctx.fillStyle = COLORS.ivory; ctx.font = '600 31px ' + SANS; ctx.fillText('SARNAGO', 70, 74);
  ctx.fillStyle = COLORS.earth; ctx.font = '500 20px ' + SANS; ctx.fillText('ABRIGAR EL REFUGIO', 70, 102);
  drawLogo(ctx, props.logo, 890, 30, 125, 70); line(ctx, 124, 0, 1080);
  ctx.fillStyle = COLORS.earth; ctx.font = '600 24px ' + SANS;
  ctx.fillText('VOCES QUE ABRIGAN EL REFUGIO', 70, cut + 69);
  const title = (props.title || 'Voces de Sarnago').trim().toUpperCase();
  let size = grid ? 94 : 122, lines;
  do {ctx.font = '600 ' + size + 'px ' + SERIF; lines = wrapLines(ctx, title, 930, 2); if (lines.every(l => ctx.measureText(l).width <= 935)) break; size -= 3;} while (size > 58);
  ctx.fillStyle = COLORS.ivory;
  lines.forEach((s, i) => ctx.fillText(s, 65, cut + (grid ? 159 : 194) + i * size * .94));
  const subY = Math.min(cut + (grid ? 159 : 194) + lines.length * size * .94 + 31, H - 119);
  ctx.font = '400 29px ' + SANS;
  wrapLines(ctx, props.subtitle || '', 920, 2).forEach((s, i) => ctx.fillText(s, 70, subY + i * 37));
  line(ctx, H - 93, 70, 1010);
  ctx.fillStyle = COLORS.earth; ctx.font = '600 22px ' + SANS;
  ctx.fillText('SARNAGO / TIERRAS ALTAS · SORIA', 70, H - 46);
  ctx.textAlign = 'right'; ctx.fillText('2026', 1010, H - 46);
  ctx.restore();
}

function text(ctx, value, x, y, width, size, family = SANS, maxLines = 2, color = COLORS.ivory) {
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.font = `600 ${size}px ${family}`;
  wrapLines(ctx, value, width, maxLines).forEach((s, i) => ctx.fillText(s, x, y + i * size * 1.15));
}
function paintLandscape(ctx, props) {
  ctx.save();
  ctx.fillStyle = COLORS.night; ctx.fillRect(0, 0, 1920, 1080);
  text(ctx, 'SARNAGO / ABRIGAR EL REFUGIO', 70, 85, 1500, 28, SANS, 1, COLORS.earth);
  drawLogo(ctx, props.logo, 1690, 30, 150, 70); line(ctx, 125, 0, 1920);
  paintCollage(ctx, props.frames || [], 0, 126, 1120, 824);
  text(ctx, 'VOCES QUE ABRIGAN EL REFUGIO', 1190, 230, 650, 24, SANS, 2, COLORS.earth);
  const title = (props.title || 'Voces de Sarnago').trim().toUpperCase();
  let size = 94; ctx.font = '600 ' + size + 'px ' + SERIF;
  while (size > 58 && wrapLines(ctx, title, 660, 3).some(l => ctx.measureText(l).width > 665)) {size -= 2; ctx.font = '600 ' + size + 'px ' + SERIF;}
  text(ctx, title, 1190, 390, 660, size, SERIF, 3);
  text(ctx, props.subtitle || '', 1190, 810, 650, 29);
  line(ctx, 950, 0, 1920);
  text(ctx, 'SARNAGO / TIERRAS ALTAS · SORIA', 70, 1020, 1600, 24, SANS, 1, COLORS.earth);
  text(ctx, '2026', 1760, 1020, 100, 24, SANS, 1, COLORS.earth);
  ctx.restore();
}
