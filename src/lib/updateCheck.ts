// iOS 的主畫面 PWA 切回前景時不會重新載入頁面，舊版會一直留著。
// 這裡在 App 回到前景時比對線上 index.html 的 bundle 檔名，
// 發現新版且人在首頁（沒有輸入到一半的表單）就自動重新整理。
export function startUpdateCheck(): void {
  if (!import.meta.env.PROD) return;
  const current = document
    .querySelector<HTMLScriptElement>('script[src*="/assets/"]')
    ?.getAttribute('src');
  if (!current) return;

  let checking = false;
  const check = async () => {
    if (checking || document.visibilityState !== 'visible') return;
    checking = true;
    try {
      const res = await fetch('/', { cache: 'no-store' });
      const html = await res.text();
      const latest = html.match(/\/assets\/index-[^"]+\.js/)?.[0];
      if (latest && latest !== current && (!location.hash || location.hash === '#/')) {
        location.reload();
      }
    } catch {
      // 離線時忽略，下次回前景再檢查
    } finally {
      checking = false;
    }
  };

  document.addEventListener('visibilitychange', () => void check());
}
