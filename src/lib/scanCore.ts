// 偵測與裁切的共用核心：主執行緒與 Web Worker 都用這份，
// 差異（canvas 建立、輸出 Blob）由 ScanEnv 注入。
// 偵測（detectQuadCore）與裁切（warpCore）分開，讓 UI 能先顯示偵測結果、
// 使用者調整四個角並按下確定後才真正裁切。

/* eslint-disable @typescript-eslint/no-explicit-any */
export type CV = any;

const DETECT_MAX_EDGE = 1000; // 偵測用的縮小尺寸，加快速度
const MIN_AREA_RATIO = 0.15; // 四邊形至少佔畫面 15%，避免誤抓小物件
const MAX_AREA_RATIO = 0.95; // 幾乎佔滿代表只抓到照片外框，視為沒偵測到

export interface Point {
  x: number;
  y: number;
}

/** 依左上、右上、右下、左下排序的四個角（原圖像素座標） */
export type Quad = [Point, Point, Point, Point];

export interface ScanEnv {
  createCanvas(width: number, height: number): {
    canvas: unknown;
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  };
  canvasToBlob(canvas: unknown): Promise<Blob | null>;
}

let cvPromise: Promise<CV> | null = null;

export function loadCV(): Promise<CV> {
  cvPromise ??= import('@techstark/opencv-js').then((mod) => {
    const cv: CV = (mod as { default?: CV }).default ?? mod;
    if (typeof cv.then === 'function') return cv; // 新版直接匯出 promise
    if (cv.Mat) return cv;
    return new Promise<CV>((resolve) => {
      cv.onRuntimeInitialized = () => resolve(cv);
    });
  });
  cvPromise.catch(() => {
    cvPromise = null; // 失敗（例如離線）下次再試
  });
  return cvPromise;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function orderCorners(points: Point[]): Quad {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const tl = bySum[0];
  const br = bySum[3];
  const byDiff = [...points].sort((a, b) => a.x - a.y - (b.x - b.y));
  const bl = byDiff[0];
  const tr = byDiff[3];
  return [tl, tr, br, bl];
}

function bitmapToImageData(env: ScanEnv, bmp: ImageBitmap, width: number, height: number): ImageData {
  const { ctx } = env.createCanvas(width, height);
  (ctx as CanvasRenderingContext2D).drawImage(bmp, 0, 0, width, height);
  return (ctx as CanvasRenderingContext2D).getImageData(0, 0, width, height);
}

/** 在縮小圖上找最大的凸四邊形，回傳原尺寸座標；找不到回傳 null */
function findQuad(cv: CV, imageData: ImageData, scale: number): Point[] | null {
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 50, 150);
    cv.dilate(edges, edges, kernel);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const frameArea = imageData.width * imageData.height;
    let bestPoints: Point[] | null = null;
    let bestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const approx = new cv.Mat();
      try {
        const area = cv.contourArea(contour);
        if (area < frameArea * MIN_AREA_RATIO || area > frameArea * MAX_AREA_RATIO) continue;
        const peri = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approx, 0.02 * peri, true);
        if (approx.rows === 4 && cv.isContourConvex(approx) && area > bestArea) {
          const points: Point[] = [];
          for (let j = 0; j < 4; j++) {
            points.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
          }
          bestPoints = points;
          bestArea = area;
        }
      } finally {
        approx.delete();
        contour.delete();
      }
    }
    return bestPoints?.map((p) => ({ x: p.x / scale, y: p.y / scale })) ?? null;
  } finally {
    src.delete();
    gray.delete();
    edges.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();
  }
}

/** 偵測照片中最大的四邊形（明信片／名片），回傳原圖座標的四角；找不到回傳 null */
export async function detectQuadCore(source: Blob, env: ScanEnv): Promise<Quad | null> {
  let bmp: ImageBitmap | null = null;
  try {
    const cv = await loadCV();
    bmp = await createImageBitmap(source);
    const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(bmp.width, bmp.height));
    const detectData = bitmapToImageData(
      env,
      bmp,
      Math.round(bmp.width * scale),
      Math.round(bmp.height * scale)
    );
    const points = findQuad(cv, detectData, scale);
    return points ? orderCorners(points) : null;
  } catch {
    return null;
  } finally {
    bmp?.close();
  }
}

/** 依四個角做透視校正裁切，回傳 JPEG Blob；失敗回傳 null */
export async function warpCore(source: Blob, corners: Quad, env: ScanEnv): Promise<Blob | null> {
  let bmp: ImageBitmap | null = null;
  try {
    const cv = await loadCV();
    bmp = await createImageBitmap(source);
    const [tl, tr, br, bl] = corners;
    const width = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
    const height = Math.round(Math.max(dist(tl, bl), dist(tr, br)));
    if (width < 50 || height < 50) return null;

    const fullData = bitmapToImageData(env, bmp, bmp.width, bmp.height);
    const srcMat = cv.matFromImageData(fullData);
    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
    const matrix = cv.getPerspectiveTransform(srcTri, dstTri);
    const out = new cv.Mat();
    try {
      cv.warpPerspective(
        srcMat,
        out,
        matrix,
        new cv.Size(width, height),
        cv.INTER_LINEAR,
        cv.BORDER_REPLICATE
      );
      const outData = new ImageData(new Uint8ClampedArray(out.data), width, height);
      const { canvas, ctx } = env.createCanvas(width, height);
      (ctx as CanvasRenderingContext2D).putImageData(outData, 0, 0);
      return await env.canvasToBlob(canvas);
    } finally {
      srcMat.delete();
      srcTri.delete();
      dstTri.delete();
      matrix.delete();
      out.delete();
    }
  } catch {
    return null;
  } finally {
    bmp?.close();
  }
}
