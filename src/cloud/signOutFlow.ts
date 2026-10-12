import { clearCachedRole } from '../lib/roles';
import { clearSignedIn, stopCloudSync } from './start';

/** 登出：停止同步、清掉登入狀態與管理員快取，然後重新載入（會回到登入畫面）。手機上的資料保留。 */
export async function signOutAndReload(): Promise<void> {
  stopCloudSync();
  const cloud = await import('./amplify');
  await cloud.cloudSignOut();
  clearSignedIn();
  // 換人登入時不能沿用上一個人的身分
  clearCachedRole();
  location.reload();
}
