// 本機資料變動訊號。資料層不認識同步，只在資料變動後發出訊號；
// 同步管理器聽到訊號後才排程上傳。
const target = new EventTarget();

export function notifyLocalChange(): void {
  target.dispatchEvent(new Event('change'));
}

export function onLocalChange(listener: () => void): () => void {
  target.addEventListener('change', listener);
  return () => target.removeEventListener('change', listener);
}
