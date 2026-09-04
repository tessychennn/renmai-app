// Web Worker：OpenCV 的載入、解析、偵測全部在這條背景執行緒，
// 主執行緒（UI）完全不會被 14MB 的程式解析凍住。
/// <reference lib="webworker" />
import { detectAndCropCore, loadCV, type ScanEnv } from './scanCore';

const env: ScanEnv = {
  createCanvas(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, ctx: canvas.getContext('2d')! };
  },
  canvasToBlob(canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  },
};

interface ScanRequest {
  id: number;
  blob?: Blob;
  preload?: boolean;
}

self.onmessage = async (e: MessageEvent<ScanRequest>) => {
  const { id, blob, preload } = e.data;
  if (preload) {
    void loadCV().catch(() => undefined);
    return;
  }
  if (!blob) {
    self.postMessage({ id, blob: null });
    return;
  }
  const result = await detectAndCropCore(blob, env);
  self.postMessage({ id, blob: result });
};
