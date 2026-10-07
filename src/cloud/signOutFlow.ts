import { clearSignedIn, stopCloudSync } from './start';

/** 登出：停止同步、清掉登入狀態與管理員快取，然後重新載入（會回到登入畫面）。手機上的資料保留。 */
export async function signOutAndReload(): Promise<void> {
  stopCloudSync();
  const cloud = await import('./amplify');
  await cloud.cloudSignOut();
  clearSignedIn();
  try {
    // 換人登入時不能沿用上一個人的管理員身分
    localStorage.removeItem('renmai.isAdmin');
  } catch {
    // 清不掉就算了，登入後會重新取得
  }
  location.reload();
}
