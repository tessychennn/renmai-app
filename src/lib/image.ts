// 🔒 壓縮邏輯獨立於 component，Capacitor 階段這裡會換成原生實作

const FULL_MAX_EDGE = 1600;
const THUMB_MAX_EDGE = 320;
const JPEG_QUALITY = 0.82;

export const UNSUPPORTED_IMAGE_MESSAGE = '這張照片格式不支援，請改用相機拍攝';

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

async function scaleToJpeg(source: Blob, maxEdge: number): Promise<CompressedImage> {
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob) throw new Error('toBlob failed');
    return { blob, width, height };
  } catch {
    throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 長邊縮到 1600px、JPEG quality 0.82 */
export function compressImage(source: Blob): Promise<CompressedImage> {
  return scaleToJpeg(source, FULL_MAX_EDGE);
}

/** 長邊 320px 的列表縮圖 */
export async function makeThumbnail(source: Blob): Promise<Blob> {
  return (await scaleToJpeg(source, THUMB_MAX_EDGE)).blob;
}

/** 讀取圖片尺寸（不壓縮），匯入備份時用 */
export async function readImageSize(source: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  } finally {
    URL.revokeObjectURL(url);
  }
}
