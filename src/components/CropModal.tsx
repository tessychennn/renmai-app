import { useEffect, useRef, useState } from 'react';
import { cropWithCorners, detectQuad, type Point, type Quad } from '../lib/documentScan';

export interface CropResult {
  blob: Blob;
  original?: Blob; // 有裁切時保留原圖，之後可還原
}

type Mode = 'quad' | 'square';

interface SquareSel {
  x: number;
  y: number;
  size: number;
}

const MIN_SQUARE = 60; // 影像像素

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
  const [display, setDisplay] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<Mode>('quad');
  const [corners, setCorners] = useState<Quad | null>(null);
  const [square, setSquare] = useState<SquareSel | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [busy, setBusy] = useState(false);
  const draggedRef = useRef(false);
  const moveOffset = useRef<{ dx: number; dy: number } | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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

  // 依可用空間算出圖片的顯示尺寸（保持比例）
  useEffect(() => {
    if (!size) return;
    const update = () => {
      const el = areaRef.current;
      if (!el) return;
      const scale = Math.min(el.clientWidth / size.w, el.clientHeight / size.h);
      setDisplay({ w: size.w * scale, h: size.h * scale });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [size]);

  // 首次切到正方形模式時，給一個置中的預設選框
  useEffect(() => {
    if (mode === 'square' && size && !square) {
      const s = Math.min(size.w, size.h) * 0.8;
      setSquare({ x: (size.w - s) / 2, y: (size.h - s) / 2, size: s });
    }
  }, [mode, size, square]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setSize({ w: img.naturalWidth, h: img.naturalHeight });
    setCorners((c) => c ?? defaultQuad(img.naturalWidth, img.naturalHeight));
  };

  const toImageCoords = (clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * size!.w, 0, size!.w),
      y: clamp(((clientY - rect.top) / rect.height) * size!.h, 0, size!.h),
    };
  };

  const capture = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const captured = (e: React.PointerEvent) =>
    (e.currentTarget as Element).hasPointerCapture(e.pointerId);

  // ── 四角模式 ──
  const moveCorner = (index: number) => (e: React.PointerEvent) => {
    if (!captured(e)) return;
    const p = toImageCoords(e.clientX, e.clientY);
    setCorners((c) => {
      if (!c) return c;
      const next = [...c] as Quad;
      next[index] = p;
      return next;
    });
  };

  // ── 正方形模式 ──
  const startSquareMove = (e: React.PointerEvent) => {
    capture(e);
    if (!square) return;
    const p = toImageCoords(e.clientX, e.clientY);
    moveOffset.current = { dx: p.x - square.x, dy: p.y - square.y };
  };

  const squareMove = (e: React.PointerEvent) => {
    if (!captured(e) || !moveOffset.current) return;
    const p = toImageCoords(e.clientX, e.clientY);
    const off = moveOffset.current;
    setSquare((s) => {
      if (!s || !size) return s;
      return {
        ...s,
        x: clamp(p.x - off.dx, 0, size.w - s.size),
        y: clamp(p.y - off.dy, 0, size.h - s.size),
      };
    });
  };

  const resizeSquare = (corner: 0 | 1 | 2 | 3) => (e: React.PointerEvent) => {
    if (!captured(e)) return;
    const p = toImageCoords(e.clientX, e.clientY);
    setSquare((s) => {
      if (!s || !size) return s;
      const anchors = [
        { x: s.x + s.size, y: s.y + s.size }, // 拖左上，錨點右下
        { x: s.x, y: s.y + s.size }, // 拖右上，錨點左下
        { x: s.x, y: s.y }, // 拖右下，錨點左上
        { x: s.x + s.size, y: s.y }, // 拖左下，錨點右上
      ];
      const anchor = anchors[corner];
      const maxW = corner === 0 || corner === 3 ? anchor.x : size.w - anchor.x;
      const maxH = corner === 0 || corner === 1 ? anchor.y : size.h - anchor.y;
      let next = Math.max(Math.abs(p.x - anchor.x), Math.abs(p.y - anchor.y));
      next = clamp(next, MIN_SQUARE, Math.min(maxW, maxH));
      return {
        x: corner === 0 || corner === 3 ? anchor.x - next : anchor.x,
        y: corner === 0 || corner === 1 ? anchor.y - next : anchor.y,
        size: next,
      };
    });
  };

  const confirmQuad = async () => {
    if (!corners) return;
    setBusy(true);
    const blob = await cropWithCorners(file, corners);
    // 裁切失敗（角度太怪、記憶體不足等）就退回原圖，不擋使用者
    onDone(blob ? { blob, original: file } : { blob: file });
  };

  const confirmSquare = async () => {
    if (!square || !imgRef.current) return;
    setBusy(true);
    try {
      const px = Math.round(square.size);
      const out = document.createElement('canvas');
      out.width = px;
      out.height = px;
      out
        .getContext('2d')!
        .drawImage(imgRef.current, square.x, square.y, square.size, square.size, 0, 0, px, px);
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, 'image/jpeg', 0.92)
      );
      onDone(blob ? { blob, original: file } : { blob: file });
    } catch {
      onDone({ blob: file });
    }
  };

  const scale = size && display ? display.w / size.w : 1;
  const handleR = 10 / scale;
  const hitR = 26 / scale;

  const squareCorners: Point[] | null = square
    ? [
        { x: square.x, y: square.y },
        { x: square.x + square.size, y: square.y },
        { x: square.x + square.size, y: square.y + square.size },
        { x: square.x, y: square.y + square.size },
      ]
    : null;

  const headerText =
    mode === 'square'
      ? '拖動方框調整位置與大小'
      : detecting
        ? '偵測邊緣中⋯'
        : '拖動四個角調整範圍';

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
        <p className="font-medium text-white">{headerText}</p>
        <span className="w-14" />
      </div>

      <div ref={areaRef} className="flex flex-1 items-center justify-center overflow-hidden px-4">
        <div
          className="relative"
          style={display ? { width: display.w, height: display.h } : undefined}
        >
          {url && (
            <img
              ref={imgRef}
              src={url}
              alt=""
              onLoad={onImgLoad}
              onError={() => onDone({ blob: file })}
              className={display ? 'h-full w-full' : 'invisible max-h-full max-w-full'}
              draggable={false}
            />
          )}
          {size && display && (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size.w} ${size.h}`}
              className="absolute inset-0 h-full w-full touch-none"
              aria-hidden="true"
            >
              {mode === 'quad' && corners && (
                <>
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
                          draggedRef.current = true;
                          capture(e);
                        }}
                        onPointerMove={moveCorner(i)}
                      />
                    </g>
                  ))}
                </>
              )}
              {mode === 'square' && square && squareCorners && (
                <>
                  <path
                    d={`M0 0H${size.w}V${size.h}H0Z M${squareCorners.map((p) => `${p.x} ${p.y}`).join(' L')}Z`}
                    fill="rgba(0,0,0,0.55)"
                    fillRule="evenodd"
                  />
                  <rect
                    x={square.x}
                    y={square.y}
                    width={square.size}
                    height={square.size}
                    fill="transparent"
                    stroke="#fff"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'move' }}
                    onPointerDown={startSquareMove}
                    onPointerMove={squareMove}
                  />
                  {squareCorners.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={handleR} fill="#fff" />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={hitR}
                        fill="transparent"
                        style={{ cursor: 'grab' }}
                        onPointerDown={capture}
                        onPointerMove={resizeSquare(i as 0 | 1 | 2 | 3)}
                      />
                    </g>
                  ))}
                </>
              )}
            </svg>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-1 px-5 pt-3">
        {modeBtn('quad', '明信片')}
        {modeBtn('square', '正方形')}
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
          disabled={busy || (mode === 'square' ? !square : !corners)}
          className="flex-1 rounded-xl bg-white px-4 py-3 font-medium text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {busy ? '裁切中⋯' : '確定'}
        </button>
      </div>
    </div>
  );
}
