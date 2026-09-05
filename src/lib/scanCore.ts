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

/**
 * Blob → ImageBitmap，強制套用 EXIF 方向。
 * iPhone 直拿拍的照片檔案是橫的、靠 EXIF 轉正；畫面上的 <img> 會自動轉，
 * 但 worker 的 createImageBitmap 不一定會——不強制的話，偵測座標會落在
 * 未轉正的座標系上，套回畫面後四個角全部錯位。
 */
async function toBitmap(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(source);
  }
}

function bitmapToImageData(env: ScanEnv, bmp: ImageBitmap, width: number, height: number): ImageData {
  const { ctx } = env.createCanvas(width, height);
  (ctx as CanvasRenderingContext2D).drawImage(bmp, 0, 0, width, height);
  return (ctx as CanvasRenderingContext2D).getImageData(0, 0, width, height);
}

interface QuadCandidate {
  points: Point[];
  area: number;
}

/** b 為頂點的夾角（度） */
function angleAt(a: Point, b: Point, c: Point): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!m) return 0;
  const cos = (v1.x * v2.x + v1.y * v2.y) / m;
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

/**
 * 過濾不像卡片的四邊形：對邊長度要接近、四角接近直角（容許透視變形）、
 * 長寬比在合理範圍。沒有這層，多策略偵測會在雜亂照片上抓出垃圾框。
 */
function isPlausibleQuad(points: Point[]): boolean {
  const [tl, tr, br, bl] = orderCorners(points);
  const top = dist(tl, tr);
  const bottom = dist(bl, br);
  const left = dist(tl, bl);
  const right = dist(tr, br);
  if (Math.min(top, bottom, left, right) <= 0) return false;
  if (Math.max(top, bottom) / Math.min(top, bottom) > 1.6) return false;
  if (Math.max(left, right) / Math.min(left, right) > 1.6) return false;
  const aspect = (top + bottom) / (left + right);
  if (aspect < 0.25 || aspect > 4) return false;
  const quad = [tl, tr, br, bl];
  for (let i = 0; i < 4; i++) {
    const ang = angleAt(quad[(i + 3) % 4], quad[i], quad[(i + 1) % 4]);
    if (ang < 55 || ang > 125) return false;
  }
  return true;
}

/** 從一張二值圖（邊緣或閾值結果）收集四邊形候選 */
function quadsFromBinary(cv: CV, binary: any, frameArea: number, candidates: QuadCandidate[]): void {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const hull = new cv.Mat();
      try {
        if (cv.contourArea(contour) < frameArea * MIN_AREA_RATIO) continue;
        // 先取凸包再逼近：邊緣有缺口或毛邊時仍能得到乾淨的四邊形
        cv.convexHull(contour, hull);
        const hullArea = cv.contourArea(hull);
        if (hullArea < frameArea * MIN_AREA_RATIO || hullArea > frameArea * MAX_AREA_RATIO) continue;
        const peri = cv.arcLength(hull, true);
        for (const eps of [0.02, 0.035, 0.05]) {
          const approx = new cv.Mat();
          try {
            cv.approxPolyDP(hull, approx, eps * peri, true);
            if (approx.rows === 4) {
              const points: Point[] = [];
              for (let j = 0; j < 4; j++) {
                points.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
              }
              candidates.push({ points, area: cv.contourArea(approx) });
              break;
            }
          } finally {
            approx.delete();
          }
        }
      } finally {
        hull.delete();
        contour.delete();
      }
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }
}

/**
 * 在縮小圖上找最大的四邊形，回傳原尺寸座標；找不到回傳 null。
 * 跑四種前處理（兩種靈敏度的 Canny、Otsu 二值化、自適應閾值），
 * 收集所有候選後取面積最大者——單一策略在陰影、低對比、光線不均下容易漏抓。
 */
function findQuad(cv: CV, imageData: ImageData, scale: number): Point[] | null {
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  const frameArea = imageData.width * imageData.height;
  const candidates: QuadCandidate[] = [];
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);

    // 變體 1、2：不同靈敏度的邊緣偵測（低閾值抓得到弱邊緣）
    for (const [lo, hi] of [
      [50, 150],
      [20, 80],
    ]) {
      const edges = new cv.Mat();
      try {
        cv.Canny(gray, edges, lo, hi);
        cv.dilate(edges, edges, kernel);
        quadsFromBinary(cv, edges, frameArea, candidates);
      } finally {
        edges.delete();
      }
    }

    // 變體 3：Otsu 全域二值化（亮卡片配暗桌面這類高對比場景最穩）
    const otsu = new cv.Mat();
    try {
      cv.threshold(gray, otsu, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      cv.morphologyEx(otsu, otsu, cv.MORPH_CLOSE, kernel);
      quadsFromBinary(cv, otsu, frameArea, candidates);
    } finally {
      otsu.delete();
    }

    // 變體 4：自適應閾值（光線不均、有陰影時的救援）
    const adaptive = new cv.Mat();
    try {
      cv.adaptiveThreshold(
        gray,
        adaptive,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        25,
        8
      );
      cv.morphologyEx(adaptive, adaptive, cv.MORPH_CLOSE, kernel);
      quadsFromBinary(cv, adaptive, frameArea, candidates);
    } finally {
      adaptive.delete();
    }

    let best: QuadCandidate | null = null;
    for (const c of candidates) {
      if (!isPlausibleQuad(c.points)) continue;
      if (!best || c.area > best.area) best = c;
    }
    return best?.points.map((p) => ({ x: p.x / scale, y: p.y / scale })) ?? null;
  } finally {
    src.delete();
    gray.delete();
    kernel.delete();
  }
}

/** 偵測照片中最大的四邊形（明信片／名片），回傳原圖座標的四角；找不到回傳 null */
export async function detectQuadCore(source: Blob, env: ScanEnv): Promise<Quad | null> {
  let bmp: ImageBitmap | null = null;
  try {
    const cv = await loadCV();
    bmp = await toBitmap(source);
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
    bmp = await toBitmap(source);
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
