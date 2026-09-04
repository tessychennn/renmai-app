// 明信片／名片自動裁切：偵測照片中最大的四邊形，透視校正後裁下。
// OpenCV（~10MB）只在第一次用到時動態載入，之後由 service worker 快取。
// 🔒 Capacitor 階段這裡會換成 iOS VisionKit 文件掃描。

/* eslint-disable @typescript-eslint/no-explicit-any */
type CV = any;

const DETECT_MAX_EDGE = 1000; // 偵測用的縮小尺寸，加快速度
const MIN_AREA_RATIO = 0.15; // 四邊形至少佔畫面 15%，避免誤抓小物件
const MAX_AREA_RATIO = 0.95; // 幾乎佔滿代表只抓到照片外框，視為沒偵測到

interface Point {
  x: number;
  y: number;
}

let cvPromise: Promise<CV> | null = null;

function loadCV(): Promise<CV> {
  cvPromise ??= import('@techstark/opencv-js').then((mod) => {
    const cv: CV = (mod as { default?: CV }).default ?? mod;
    if (typeof cv.then === 'function') return cv; // 新版直接匯出 promise
    if (cv.Mat) return cv;
    return new Promise<CV>((resolve) => {
      cv.onRuntimeInitialized = () => resolve(cv);
    });
  });
  return cvPromise;
}

/** 背景預載 OpenCV，讓第一張照片不用等下載 */
export function preloadScanner(): void {
  void loadCV().catch(() => {
    cvPromise = null; // 失敗（例如離線）下次再試
  });
}

async function blobToImage(source: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToCanvas(img: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
  return canvas;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** 依左上、右上、右下、左下排序四個角 */
function orderCorners(points: Point[]): [Point, Point, Point, Point] {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const tl = bySum[0];
  const br = bySum[3];
  const byDiff = [...points].sort((a, b) => a.x - a.y - (b.x - b.y));
  const bl = byDiff[0];
  const tr = byDiff[3];
  return [tl, tr, br, bl];
}

/** 在縮小圖上找最大的凸四邊形，回傳原尺寸座標；找不到回傳 null */
function findQuad(cv: CV, canvas: HTMLCanvasElement, scale: number): Point[] | null {
  const src = cv.imread(canvas);
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

    const frameArea = canvas.width * canvas.height;
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

/**
 * 偵測並裁切照片中的明信片／名片。
 * 成功回傳裁好的 JPEG Blob；偵測不到（或任何錯誤）回傳 null，呼叫端保留原圖。
 */
export async function detectAndCrop(source: Blob): Promise<Blob | null> {
  try {
    const cv = await loadCV();
    const img = await blobToImage(source);
    const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const detectCanvas = drawToCanvas(
      img,
      Math.round(img.naturalWidth * scale),
      Math.round(img.naturalHeight * scale)
    );

    const quad = findQuad(cv, detectCanvas, scale);
    if (!quad) return null;

    const [tl, tr, br, bl] = orderCorners(quad);
    const width = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
    const height = Math.round(Math.max(dist(tl, bl), dist(tr, br)));
    if (width < 50 || height < 50) return null;

    const fullCanvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight);
    const srcMat = cv.imread(fullCanvas);
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
      const outCanvas = document.createElement('canvas');
      cv.imshow(outCanvas, out);
      return await new Promise<Blob | null>((resolve) =>
        outCanvas.toBlob(resolve, 'image/jpeg', 0.92)
      );
    } finally {
      srcMat.delete();
      srcTri.delete();
      dstTri.delete();
      matrix.delete();
      out.delete();
    }
  } catch {
    return null;
  }
}
