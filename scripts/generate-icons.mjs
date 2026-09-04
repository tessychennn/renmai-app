import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// 人形剪影，深底白圖，不含文字（librsvg 在各平台的 CJK 字體不可靠）
function iconSVG(size, { padding = 0 } = {}) {
  const s = size;
  const scale = 1 - padding * 2;
  const cx = s / 2;
  const headR = s * 0.13 * scale;
  const headCy = s * 0.4;
  const shoulderW = s * 0.44 * scale;
  const shoulderH = s * 0.26 * scale;
  const shoulderY = s * 0.56;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="#1D1D1F"/>
  <circle cx="${cx}" cy="${headCy}" r="${headR}" fill="#F5F5F7"/>
  <rect x="${cx - shoulderW / 2}" y="${shoulderY}" width="${shoulderW}" height="${shoulderH}" rx="${shoulderH / 2}" fill="#F5F5F7"/>
</svg>`;
}

async function render(svg, out) {
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log('✓', out);
}

await mkdir('public', { recursive: true });
await render(iconSVG(192), 'public/icon-192.png');
await render(iconSVG(512), 'public/icon-512.png');
await render(iconSVG(512, { padding: 0.1 }), 'public/icon-512-maskable.png');
await render(iconSVG(180), 'public/apple-touch-icon.png');
