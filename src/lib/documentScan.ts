// 明信片／名片裁切的進入點：偵測（detectQuad）與裁切（cropWithCorners）分開，
// UI 先顯示偵測到的邊框、使用者確認後才裁。
// 優先走 Web Worker（不卡 UI）；環境不支援時退回主執行緒實作。
// 🔒 Capacitor 階段這裡會換成 iOS VisionKit 文件掃描。
import {
  detectQuadCore,
  loadCV,
  warpCore,
  type Quad,
  type ScanEnv,
} from './scanCore';

export type { Point, Quad } from './scanCore';

const SCAN_TIMEOUT_MS = 30_000;

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<number, (result: unknown) => void>();

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
      worker.onmessage = (e: MessageEvent<{ id: number; result: unknown }>) => {
        pending.get(e.data.id)?.(e.data.result);
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

function callWorker<T>(op: 'detect' | 'warp', blob: Blob, corners?: Quad): Promise<T | null> {
  const w = getWorker()!;
  return new Promise<T | null>((resolve) => {
    const id = ++seq;
    pending.set(id, resolve as (result: unknown) => void);
    w.postMessage({ id, op, blob, corners });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve(null);
      }
    }, SCAN_TIMEOUT_MS);
  });
}

/** 背景預載 OpenCV（在 worker 裡），讓第一張照片不用等下載 */
export function preloadScanner(): void {
  const w = getWorker();
  if (w) {
    w.postMessage({ id: 0, op: 'preload' });
  }
  // 不支援 worker 的環境不預載：主執行緒解析 14MB 會凍住 UI，
  // 等真的用到再載。
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

/** 偵測照片中的明信片／名片邊框；找不到（或錯誤）回傳 null */
export async function detectQuad(source: Blob): Promise<Quad | null> {
  if (getWorker()) return callWorker<Quad>('detect', source);
  try {
    await loadCV();
    return await detectQuadCore(source, mainEnv);
  } catch {
    return null;
  }
}

/** 依四個角透視裁切；失敗回傳 null，呼叫端保留原圖 */
export async function cropWithCorners(source: Blob, corners: Quad): Promise<Blob | null> {
  if (getWorker()) return callWorker<Blob>('warp', source, corners);
  try {
    await loadCV();
    return await warpCore(source, corners, mainEnv);
  } catch {
    return null;
  }
}
