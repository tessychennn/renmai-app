import { useRef } from 'react';

/**
 * 長按偵測（觸控與滑鼠都可，桌面右鍵也算）。
 * 長按觸發後會吃掉接下來那一下 click，避免放開手指時順便點進連結。
 * 手指移動超過 10px（在捲動或拖曳）就取消。
 */
export function useLongPress(onLongPress: () => void, delayMs = 450) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    origin.current = null;
  };

  const trigger = () => {
    fired.current = true;
    cancel();
    onLongPress();
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(trigger, delayMs);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!origin.current) return;
      if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // 擋掉瀏覽器原生選單；桌面右鍵直接當長按
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!fired.current) trigger();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}
