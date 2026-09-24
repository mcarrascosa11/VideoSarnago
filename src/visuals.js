export const COLORS = {
  night: '#18212b',
  deep: '#101820',
  ivory: '#f2ede4',
  earth: '#b79a70',
  warm: '#897051',
};

export function imageFit(ctx, image, x, y, w, h, mode = 'cover') {
  if (!image || !image.naturalWidth && !image.videoWidth) {
    ctx.fillStyle = '#8c8478'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#716c61'; ctx.fillRect(x + w * .12, y + h * .13, w * .76, h * .74);
    ctx.strokeStyle = '#bcb19d'; ctx.lineWidth = 2;
    ctx.strokeRect(x + w * .12, y + h * .13, w * .76, h * .74);
    return;
  }
  const iw = image.videoWidth || image.naturalWidth;
  const ih = image.videoHeight || image.naturalHeight;
  const scale = mode === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
  const tw = iw * scale, th = ih * scale;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(image, x + (w - tw) / 2, y + (h - th) / 2, tw, th);
  ctx.restore();
}

function line(ctx, y, x1 = 70, x2 = 1010, color = COLORS.earth, width = 2) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
  ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
}

export function wrapLines(ctx, text, maxWidth, maxLines = 4) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = []; let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current); current = word;
    } else current = test;
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    clipped[maxLines - 1] = lines.slice(maxLines - 1).join(' ');
    while (ctx.measureText(clipped[maxLines - 1] + '…').width > maxWidth && clipped[maxLines - 1].length > 3)
      clipped[maxLines - 1] = clipped[maxLines - 1].slice(0, -2);
    clipped[maxLines - 1] += '…';
    return clipped;
  }
  return lines;
}

function fitFont(ctx, text, maxWidth, startSize, minSize, family, weight = 600) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = weight + ' ' + size + 'px ' + family;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = weight + ' ' + size + 'px ' + family;
  return size;
}

function drawLogo(ctx, logo, x, y, maxW, maxH) {
  if (!logo || !logo.naturalWidth) return;
  const k = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight);
  ctx.drawImage(logo, x, y, logo.naturalWidth * k, logo.naturalHeight * k);
}

function header(ctx, logo) {
  ctx.fillStyle = COLORS.night;
  ctx.fillRect(0, 0, 1080, 125);
  ctx.fillStyle = COLORS.ivory;
  ctx.font = '600 31px "DM Sans", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SARNAGO', 70, 74);
  ctx.fillStyle = COLORS.earth;
  ctx.font = '500 20px "DM Sans", Arial, sans-serif';
  ctx.fillText('ABRIGAR EL REFUGIO', 70, 102);
  drawLogo(ctx, logo, 890, 30, 125, 70);
  line(ctx, 124, 0, 1080);
}

export function paintCover(ctx, props, grid = false) {
  const H = grid ? 1350 : 1920;
  ctx.save(); ctx.fillStyle = COLORS.night; ctx.fillRect(0, 0, 1080, H);
  const cut = grid ? 775 : 1180;
  imageFit(ctx, props.photo, 0, 125, 1080, cut - 125);
  header(ctx, props.logo);
  line(ctx, cut, 0, 1080);
  ctx.fillStyle = COLORS.earth;
  ctx.font = '600 24px "DM Sans", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VOCES QUE ABRIGAN EL REFUGIO', 70, cut + 69);
  ctx.fillStyle = COLORS.ivory;
  const name = (props.name || 'NOMBRE APELLIDOS').trim().toUpperCase();
  let size = grid ? 94 : 122, nameLines;
  do {
    ctx.font = '600 ' + size + 'px "Cormorant Garamond", Georgia, serif';
    nameLines = wrapLines(ctx, name, 930, 3);
    if (nameLines.every(l => ctx.measureText(l).width <= 935)) break;
    size -= 3;
  } while (size > 58);
  const available = grid ? 240 : 350;
  const lh = size * .95;
  if (nameLines.length * lh > available) size = Math.floor(available / nameLines.length);
  ctx.font = '600 ' + size + 'px "Cormorant Garamond", Georgia, serif';
  nameLines.forEach((s, i) => ctx.fillText(s, 65, cut + (grid ? 159 : 194) + i * size * .94));
  const roleY = Math.min(cut + (grid ? 159 : 194) + nameLines.length * size * .94 + 31, H - 119);
  ctx.fillStyle = COLORS.ivory; ctx.font = '400 29px "DM Sans", Arial, sans-serif';
  const roleLines = wrapLines(ctx, props.role || 'Profesión / cargo', 920, 2);
  roleLines.forEach((s, i) => ctx.fillText(s, 70, roleY + i * 37));
  line(ctx, H - 93);
  ctx.fillStyle = COLORS.earth; ctx.font = '600 22px "DM Sans", Arial, sans-serif';
  ctx.fillText('SARNAGO / TIERRAS ALTAS · SORIA', 70, H - 46);
  ctx.textAlign = 'right'; ctx.fillText('2026', 1010, H - 46);
  ctx.restore();
}

function activeCue(cues, current) {
  return (cues || []).find(c => current >= c.start && current < c.end && c.text);
}

export function paintFrame(ctx, props) {
  ctx.save();
  ctx.fillStyle = COLORS.deep; ctx.fillRect(0, 0, 1080, 1920);
  imageFit(ctx, props.video, 0, 0, 1080, 1775);
  const cue = activeCue(props.cues, props.time || 0);
  if (cue) {
    ctx.font = '600 56px "DM Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    const words = wrapLines(ctx, cue.text, 900, 3);
    const h = words.length * 72 + 38;
    const y = 1660 - h;
    ctx.fillStyle = COLORS.night;
    ctx.fillRect(46, y, 988, h);
    ctx.fillStyle = COLORS.ivory;
    words.forEach((s, i) => ctx.fillText(s, 540, y + 69 + i * 72));
  }
  ctx.fillStyle = COLORS.night; ctx.fillRect(0, 1775, 1080, 145);
  line(ctx, 1776, 0, 1080);
  ctx.textAlign = 'left'; ctx.fillStyle = COLORS.ivory;
  ctx.font = '600 31px "DM Sans", Arial, sans-serif';
  ctx.fillText('ABRIGAR EL REFUGIO', 60, 1840);
  ctx.font = '400 25px "DM Sans", Arial, sans-serif';
  ctx.fillStyle = COLORS.earth;
  ctx.fillText(props.shortUrl || 'APOYA LA CAMPAÑA EN GOTEO', 60, 1890);
  if ((props.time || 0) < 4.5 && (props.name || '').trim()) {
    ctx.fillStyle = COLORS.night; ctx.fillRect(0, 150, 830, 160);
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '600 43px "Cormorant Garamond", Georgia, serif';
    const title = wrapLines(ctx, props.name, 710, 1)[0] || '';
    ctx.fillText(title, 58, 223);
    ctx.fillStyle = COLORS.earth; ctx.font = '400 22px "DM Sans", Arial, sans-serif';
    ctx.fillText(wrapLines(ctx, props.role, 710, 1)[0] || '', 58, 264);
  }
  ctx.restore();
}

export function paintOutro(ctx, props) {
  ctx.save();
  ctx.fillStyle = COLORS.night; ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = COLORS.earth; ctx.font = '600 28px "DM Sans", Arial, sans-serif';
  ctx.textAlign = 'left'; ctx.fillText('ABRIGAR EL REFUGIO  /  SARNAGO', 70, 148);
  line(ctx, 185);
  ctx.fillStyle = COLORS.ivory;
  ctx.font = '600 169px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('APÓYANOS', 65, 488);
  ctx.font = '500 64px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('Ayúdanos a seguir', 70, 612);
  ctx.fillText('construyendo Sarnago.', 70, 684);
  line(ctx, 773);
  if (props.qrImage) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(70, 861, 530, 530);
    ctx.drawImage(props.qrImage, 94, 885, 482, 482);
    ctx.fillStyle = COLORS.earth; ctx.font = '600 27px "DM Sans", Arial, sans-serif';
    ctx.fillText('ESCANEA Y COLABORA', 70, 1466);
  } else {
    ctx.strokeStyle = COLORS.earth; ctx.lineWidth = 3; ctx.strokeRect(70, 861, 530, 530);
    ctx.fillStyle = COLORS.earth; ctx.font = '28px "DM Sans", Arial, sans-serif';
    ctx.fillText('CONFIGURA EL ENLACE', 99, 1140);
  }
  ctx.fillStyle = COLORS.ivory;
  ctx.font = '600 33px "DM Sans", Arial, sans-serif';
  const site = props.shortUrl || 'GOTEO.ORG';
  wrapLines(ctx, site, 900, 2).forEach((l, i) => ctx.fillText(l, 70, 1572 + i * 44));
  line(ctx, 1708);
  ctx.fillStyle = COLORS.ivory; ctx.font = '500 29px "DM Sans", Arial, sans-serif';
  ctx.fillText('SARNAGO', 70, 1782);
  ctx.fillStyle = COLORS.earth;
  ctx.font = '400 23px "DM Sans", Arial, sans-serif';
  ctx.fillText('TIERRA DE NADIE, TIERRA DE TODOS', 70, 1831);
  drawLogo(ctx, props.logo, 840, 1720, 160, 110);
  ctx.restore();
}

export function makeCanvas(width = 1080, height = 1920) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

export function drawScaled(canvas, draw, props, grid = false) {
  const ctx = canvas.getContext('2d', {alpha: false});
  ctx.save(); ctx.setTransform(canvas.width / 1080, 0, 0, canvas.height / (grid ? 1350 : 1920), 0, 0);
  draw(ctx, props, grid);
  ctx.restore();
}

export function canvasPng(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo crear la imagen.')), 'image/png'));
}
