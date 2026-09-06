import { useEffect, useRef, useState } from 'react';
import { cropWithCorners, detectQuad, type Point, type Quad } from '../lib/documentScan';

export interface CropResult {
  blob: Blob;
  original?: Blob; // 有裁切時保留原圖，之後可還原
}

type Mode = 'quad' | 'square';

/** 正方形模式的影像視圖：縮放倍率與影像左上角在區域中的位置 */
interface View {
  z: number;
  ox: number;
  oy: number;
}

const MIN_SQUARE = 60; // 裁切輸出的最小影像像素

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function defaultQuad(w: number, h: number): Quad {
  const mx = w * 0.06;
  const my = h * 0.06;
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my },
  ];
}

export default function CropModal({
  file,
  onDone,
}: {
  file: Blob;
  /** null = 取消這張照片 */
  onDone: (result: CropResult | null) => void;
}) {
  const [url, setUrl] = useState<string>();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<Mode>('quad');
  const [corners, setCorners] = useState<Quad | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [busy, setBusy] = useState(false);
  const draggedRef = useRef(false);
  const pointers = useRef(new Map<number, Point>());
  const areaRef = useRef<HTMLDivElement>(null);
  const quadSvgRef = useRef<SVGSVGElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 在 effect 裡建立／撤銷 blob URL，StrictMode 的掛載→卸載→再掛載才不會拿到已撤銷的 URL
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    void detectQuad(file).then((quad) => {
      if (cancelled) return;
      setDetecting(false);
      if (quad && !draggedRef.current) setCorners(quad);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // 追蹤可用區域大小
  useEffect(() => {
    const update = () => {
      const el = areaRef.current;
      if (el) setArea({ w: el.clientWidth, h: el.clientHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setSize({ w: img.naturalWidth, h: img.naturalHeight });
    setCorners((c) => c ?? defaultQuad(img.naturalWidth, img.naturalHeight));
  };

  // 圖片在區域內的合身尺寸（保持比例）
  const display =
    size && area
      ? (() => {
          const s = Math.min(area.w / size.w, area.h / size.h);
          return { w: size.w * s, h: size.h * s };
        })()
      : null;
  const quadLeft = area && display ? (area.w - display.w) / 2 : 0;
  const quadTop = area && display ? (area.h - display.h) / 2 : 0;

  // 正方形模式的固定選框
  const frameSize = area ? Math.min(area.w, area.h) * 0.85 : 0;
  const frameLeft = area ? (area.w - frameSize) / 2 : 0;
  const frameTop = area ? (area.h - frameSize) / 2 : 0;
  const zMin = display ? Math.max(frameSize / display.w, frameSize / display.h) : 1;
  const zMax =
    display && size
      ? Math.max(zMin, Math.min(12, (frameSize * size.w) / (display.w * MIN_SQUARE)))
      : 1;

  const clampView = (v: View): View => {
    if (!display) return v;
    const iw = display.w * v.z;
    const ih = display.h * v.z;
    return {
      z: v.z,
      ox: clamp(v.ox, frameLeft + frameSize - iw, frameLeft),
      oy: clamp(v.oy, frameTop + frameSize - ih, frameTop),
    };
  };

  // 進入正方形模式時：以剛好蓋滿選框的倍率置中
  useEffect(() => {
    if (mode !== 'square' || !display || !area || view) return;
    const z = Math.max(frameSize / display.w, frameSize / display.h);
    setView(
      clampView({
        z,
        ox: frameLeft + (frameSize - display.w * z) / 2,
        oy: frameTop + (frameSize - display.h * z) / 2,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, display?.w, display?.h, area?.w, area?.h]);

  // ── 四角模式 ──
  const toImageCoords = (clientX: number, clientY: number): Point => {
    const rect = quadSvgRef.current!.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * size!.w, 0, size!.w),
      y: clamp(((clientY - rect.top) / rect.height) * size!.h, 0, size!.h),
    };
  };

  const moveCorner = (index: number) => (e: React.PointerEvent) => {
    if (!(e.currentTarget as Element).hasPointerCapture(e.pointerId)) return;
    const p = toImageCoords(e.clientX, e.clientY);
    setCorners((c) => {
      if (!c) return c;
      const next = [...c] as Quad;
      next[index] = p;
      return next;
    });
  };

  // ── 正方形模式：單指平移、雙指縮放 ──
  const zoomAt = (mid: Point, k: number) => {
    setView((v) => {
      if (!v) return v;
      const z2 = clamp(v.z * k, zMin, zMax);
      const k2 = z2 / v.z;
      return clampView({ z: z2, ox: mid.x - (mid.x - v.ox) * k2, oy: mid.y - (mid.y - v.oy) * k2 });
    });
  };

  const zoomButton = (k: number) => {
    zoomAt({ x: frameLeft + frameSize / 2, y: frameTop + frameSize / 2 }, k);
  };

  const onSquareDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onSquareMove = (e: React.PointerEvent) => {
    const pts = pointers.current;
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    if (pts.size === 1) {
      pts.set(e.pointerId, now);
      setView((v) => (v ? clampView({ ...v, ox: v.ox + now.x - prev.x, oy: v.oy + now.y - prev.y }) : v));
    } else {
      const ids = [...pts.keys()];
      const otherId = ids.find((id) => id !== e.pointerId)!;
      const other = pts.get(otherId)!;
      const dPrev = Math.hypot(prev.x - other.x, prev.y - other.y);
      pts.set(e.pointerId, now);
      const dNow = Math.hypot(now.x - other.x, now.y - other.y);
      if (dPrev > 10 && areaRef.current) {
        const rect = areaRef.current.getBoundingClientRect();
        zoomAt(
          { x: (now.x + other.x) / 2 - rect.left, y: (now.y + other.y) / 2 - rect.top },
          dNow / dPrev
        );
      }
    }
  };

  const onSquareUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  // ── 確定 ──
  const confirmQuad = async () => {
    if (!corners) return;
    setBusy(true);
    const blob = await cropWithCorners(file, corners);
    // 裁切失敗（角度太怪、記憶體不足等）就退回原圖，不擋使用者
    onDone(blob ? { blob, original: file } : { blob: file });
  };

  const confirmSquare = async () => {
    if (!view || !display || !size || !imgRef.current) return;
    setBusy(true);
    try {
      const pxRatio = size.w / (display.w * view.z);
      const srcSize = clamp(frameSize * pxRatio, 1, Math.min(size.w, size.h));
      const srcX = clamp((frameLeft - view.ox) * pxRatio, 0, size.w - srcSize);
      const srcY = clamp((frameTop - view.oy) * pxRatio, 0, size.h - srcSize);
      const side = Math.max(1, Math.round(srcSize));
      const out = document.createElement('canvas');
      out.width = side;
      out.height = side;
      out.getContext('2d')!.drawImage(imgRef.current, srcX, srcY, srcSize, srcSize, 0, 0, side, side);
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, 'image/jpeg', 0.92)
      );
      onDone(blob ? { blob, original: file } : { blob: file });
    } catch {
      onDone({ blob: file });
    }
  };

  const quadScale = size && display ? display.w / size.w : 1;
  const handleR = 10 / quadScale;
  const hitR = 26 / quadScale;

  const headerText =
    mode === 'square'
      ? '單指移動照片、雙指縮放'
      : detecting
        ? '偵測邊緣中⋯'
        : '拖動四個角調整範圍';

  const imgStyle: React.CSSProperties | undefined =
    mode === 'quad'
      ? display
        ? { left: quadLeft, top: quadTop, width: display.w, height: display.h }
        : undefined
      : display && view
        ? {
            left: 0,
            top: 0,
            width: display.w * view.z,
            height: display.h * view.z,
            transform: `translate(${view.ox}px, ${view.oy}px)`,
          }
        : undefined;

  const modeBtn = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={`rounded-full px-4 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
        mode === m ? 'bg-white text-ink' : 'text-white/80'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="裁切照片">
      <div
        className="flex items-center justify-between px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button
          type="button"
          onClick={() => onDone(null)}
          disabled={busy}
          className="rounded-full px-3 py-1.5 font-medium text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          取消
        </button>
        <p className="text-sm font-medium text-white">{headerText}</p>
        <span className="w-14" />
      </div>

      <div ref={areaRef} className="relative flex-1 overflow-hidden">
        {url && (
          <img
            ref={imgRef}
            src={url}
            alt=""
            onLoad={onImgLoad}
            onError={() => onDone({ blob: file })}
            className={`absolute max-w-none select-none ${imgStyle ? '' : 'invisible'}`}
            style={imgStyle}
            draggable={false}
          />
        )}

        {mode === 'quad' && size && display && corners && (
          <svg
            ref={quadSvgRef}
            viewBox={`0 0 ${size.w} ${size.h}`}
            className="absolute touch-none"
            style={{ left: quadLeft, top: quadTop, width: display.w, height: display.h }}
            aria-hidden="true"
          >
            <path
              d={`M0 0H${size.w}V${size.h}H0Z M${corners.map((p) => `${p.x} ${p.y}`).join(' L')}Z`}
              fill="rgba(0,0,0,0.55)"
              fillRule="evenodd"
            />
            <polygon
              points={corners.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {corners.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={handleR} fill="#fff" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hitR}
                  fill="transparent"
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    draggedRef.current = true;
                    (e.currentTarget as Element).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={moveCorner(i)}
                />
              </g>
            ))}
          </svg>
        )}

        {mode === 'square' && area && view && (
          <svg
            viewBox={`0 0 ${area.w} ${area.h}`}
            className="absolute inset-0 h-full w-full touch-none"
            style={{ cursor: 'move' }}
            aria-hidden="true"
            onPointerDown={onSquareDown}
            onPointerMove={onSquareMove}
            onPointerUp={onSquareUp}
            onPointerCancel={onSquareUp}
          >
            <path
              d={`M0 0H${area.w}V${area.h}H0Z M${frameLeft} ${frameTop}H${frameLeft + frameSize}V${frameTop + frameSize}H${frameLeft}Z`}
              fill="rgba(0,0,0,0.55)"
              fillRule="evenodd"
            />
            <rect
              x={frameLeft}
              y={frameTop}
              width={frameSize}
              height={frameSize}
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      <div className="flex items-center justify-center gap-1 px-5 pt-3">
        {modeBtn('quad', '明信片')}
        {modeBtn('square', '正方形')}
        {mode === 'square' && (
          <span className="ml-3 flex gap-1">
            <button
              type="button"
              onClick={() => zoomButton(0.8)}
              aria-label="縮小"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => zoomButton(1.25)}
              aria-label="放大"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              ＋
            </button>
          </span>
        )}
      </div>

      <div
        className="flex gap-2 px-5 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <button
          type="button"
          onClick={() => onDone({ blob: file })}
          disabled={busy}
          className="flex-1 rounded-xl border border-white/30 px-4 py-3 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          用原圖
        </button>
        <button
          type="button"
          onClick={() => void (mode === 'square' ? confirmSquare() : confirmQuad())}
          disabled={busy || (mode === 'square' ? !view : !corners)}
          className="flex-1 rounded-xl bg-white px-4 py-3 font-medium text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {busy ? '裁切中⋯' : '確定'}
        </button>
      </div>
    </div>
  );
}
