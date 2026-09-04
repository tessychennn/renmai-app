// 明信片／名片自動裁切的進入點。
// 優先走 Web Worker（不卡 UI）；環境不支援時退回主執行緒實作。
// 🔒 Capacitor 階段這裡會換成 iOS VisionKit 文件掃描。
import { detectAndCropCore, loadCV, type ScanEnv } from './scanCore';

const SCAN_TIMEOUT_MS = 20_000;

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<number, (blob: Blob | null) => void>();

function workerSupported(): boolean {
  return (
    !workerBroken &&
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined'
  );
}

function getWorker(): Worker | null {
  if (!workerSupported()) return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./scanWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ id: number; blob: Blob | null }>) => {
        pending.get(e.data.id)?.(e.data.blob);
        pending.delete(e.data.id);
      };
      worker.onerror = () => {
        for (const resolve of pending.values()) resolve(null);
        pending.clear();
        worker?.terminate();
        worker = null;
        workerBroken = true; // 之後改走主執行緒退路
      };
    } catch {
      worker = null;
      workerBroken = true;
    }
  }
  return worker;
}

/** 背景預載 OpenCV（在 worker 裡），讓第一張照片不用等下載 */
export function preloadScanner(): void {
  const w = getWorker();
  if (w) {
    w.postMessage({ id: 0, preload: true });
  }
  // 不支援 worker 的環境不預載：主執行緒解析 14MB 會凍住 UI，
  // 等真的拍了第一張再載（偵測中標籤會多轉幾秒）。
}

const mainEnv: ScanEnv = {
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext('2d')! };
  },
  canvasToBlob(canvas) {
    return new Promise<Blob | null>((resolve) =>
      (canvas as HTMLCanvasElement).toBlob(resolve, 'image/jpeg', 0.92)
    );
  },
};

/**
 * 偵測並裁切照片中的明信片／名片。
 * 成功回傳裁好的 JPEG Blob；偵測不到（或任何錯誤）回傳 null，呼叫端保留原圖。
 */
export async function detectAndCrop(source: Blob): Promise<Blob | null> {
  const w = getWorker();
  if (w) {
    return new Promise<Blob | null>((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      w.postMessage({ id, blob: source });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve(null);
        }
      }, SCAN_TIMEOUT_MS);
    });
  }
  try {
    await loadCV();
    return await detectAndCropCore(source, mainEnv);
  } catch {
    return null;
  }
}
