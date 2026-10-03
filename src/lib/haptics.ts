// 觸覺回饋。
// - Android 與支援的瀏覽器：navigator.vibrate。
// - iPhone：Safari 完全不支援 Vibration API。iOS 17.4 以後，切換 <input type="checkbox" switch>
//   會觸發系統的輕微觸覺，這是目前網頁唯一的做法，非官方保證；舊版 iOS 或主畫面 App
//   行為不同時就沒有震動，但不會出錯。
// 🔒 Capacitor 階段改用 @capacitor/haptics（真正的原生觸覺）。

let switchLabel: HTMLLabelElement | null = null;

function iosSwitchTick(): void {
  if (typeof document === 'undefined' || !document.body) return;
  if (!switchLabel || !switchLabel.isConnected) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    switchLabel = label;
  }
  switchLabel.click();
}

/**
 * 手指放開時補一下，只在沒有 vibrate 的裝置（也就是 iPhone）。
 * iPhone 只在「真正的使用者操作事件」（放開手指、點擊）裡放行觸覺；
 * 長按是計時器在按住 0.45 秒後觸發的，常被擋掉，放開手指這一刻比較可能成功。
 */
export function hapticTickOnRelease(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return;
    iosSwitchTick();
  } catch {
    // 同上，觸覺失敗不影響操作
  }
}

/** 輕微一下：用在長按觸發的瞬間，讓手指知道「已經按下去了」 */
export function hapticTick(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      // 回傳 false 代表被瀏覽器擋掉（例如沒有使用者操作），接著試 iOS 的做法也無妨
      if (navigator.vibrate(15)) return;
    }
    iosSwitchTick();
  } catch {
    // 觸覺只是加分，任何失敗都不該影響操作
  }
}
