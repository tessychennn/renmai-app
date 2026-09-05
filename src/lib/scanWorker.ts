// Web Worker：OpenCV 的載入、解析、偵測、裁切全部在背景執行緒，
// 主執行緒（UI）完全不會被 14MB 的程式解析凍住。
/// <reference lib="webworker" />
import { detectQuadCore, loadCV, warpCore, type Quad, type ScanEnv } from './scanCore';

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
  op: 'preload' | 'detect' | 'warp';
  blob?: Blob;
  corners?: Quad;
}

self.onmessage = async (e: MessageEvent<ScanRequest>) => {
  const { id, op, blob, corners } = e.data;
  if (op === 'preload') {
    void loadCV().catch(() => undefined);
    return;
  }
  if (!blob) {
    self.postMessage({ id, result: null });
    return;
  }
  const result =
    op === 'detect'
      ? await detectQuadCore(blob, env)
      : corners
        ? await warpCore(blob, corners, env)
        : null;
  self.postMessage({ id, result });
};
