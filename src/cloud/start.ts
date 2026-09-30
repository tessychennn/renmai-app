import { setPhotoTransport, syncLocal } from '../data';
import { syncManager } from '../sync/manager';

/** 登入完成後呼叫：接上雲端、開始同步。 */
export async function startCloudSync(): Promise<void> {
  const cloud = await import('./amplify');
  const remote = cloud.createRemoteStore();
  // 本機沒有的照片（另一支手機新增的）點開時才向雲端下載
  setPhotoTransport({ download: (id, variant) => remote.downloadPhoto(id, variant) });
  syncManager.start(syncLocal, remote);
}

export function stopCloudSync(): void {
  syncManager.stop();
  setPhotoTransport(null);
}

const SEEN_KEY = 'renmai.cloudSeen';

/** 這支手機登入過雲端帳號。之後沒網路或登入失效時仍可看本機資料。 */
export function hasSignedInBefore(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSignedIn(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // 存不了只影響離線開啟時的登入判斷
  }
}

export function clearSignedIn(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // 同上
  }
}
