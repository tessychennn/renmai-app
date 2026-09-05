import { useEffect, useRef, useState } from 'react';
import { cropWithCorners, detectQuad, type Point, type Quad } from '../lib/documentScan';

export interface CropResult {
  blob: Blob;
  original?: Blob; // 有裁切時保留原圖，之後可還原
}

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
  const [corners, setCorners] = useState<Quad | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [busy, setBusy] = useState(false);
  const draggedRef = useRef(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    draggedRef.current = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const moveDrag = (index: number) => (e: React.PointerEvent) => {
    if (!(e.currentTarget as Element).hasPointerCapture(e.pointerId)) return;
    const p = toImageCoords(e.clientX, e.clientY);
    setCorners((c) => {
      if (!c) return c;
      const next = [...c] as Quad;
      next[index] = p;
      return next;
    });
  };

  const confirm = async () => {
    if (!corners) return;
    setBusy(true);
    const blob = await cropWithCorners(file, corners);
    // 裁切失敗（角度太怪、記憶體不足等）就退回原圖，不擋使用者
    onDone(blob ? { blob, original: file } : { blob: file });
  };

  const scale = size && display ? display.w / size.w : 1;
  const handleR = 10 / scale;
  const hitR = 26 / scale;
  const polyPoints = corners?.map((p) => `${p.x},${p.y}`).join(' ');

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
        <p className="font-medium text-white">
          {detecting ? '偵測邊緣中⋯' : '拖動四個角調整範圍'}
        </p>
        <span className="w-14" />
      </div>

      <div ref={areaRef} className="flex flex-1 items-center justify-center overflow-hidden px-4">
        <div
          className="relative"
          style={display ? { width: display.w, height: display.h } : undefined}
        >
          {url && (
            <img
              src={url}
              alt=""
              onLoad={onImgLoad}
              onError={() => onDone({ blob: file })}
              className={display ? 'h-full w-full' : 'invisible max-h-full max-w-full'}
              draggable={false}
            />
          )}
          {size && display && corners && (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size.w} ${size.h}`}
              className="absolute inset-0 h-full w-full touch-none"
              aria-hidden="true"
            >
              <path
                d={`M0 0H${size.w}V${size.h}H0Z M${corners.map((p) => `${p.x} ${p.y}`).join(' L')}Z`}
                fill="rgba(0,0,0,0.55)"
                fillRule="evenodd"
              />
              <polygon
                points={polyPoints}
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
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag(i)}
                  />
                </g>
              ))}
            </svg>
          )}
        </div>
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
          onClick={() => void confirm()}
          disabled={busy || !corners}
          className="flex-1 rounded-xl bg-white px-4 py-3 font-medium text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {busy ? '裁切中⋯' : '確定'}
        </button>
      </div>
    </div>
  );
}
