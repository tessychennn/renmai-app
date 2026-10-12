// 登入者的身分（Cognito 群組）：
//   admin  管理員：全部功能，可以改待辦的選項設定
//   team   團隊成員：人脈記錄、待辦、產品進度
//   tech   技術端：只能用產品進度（伺服器端也只開放這一張資料表，見 amplify/data/resource.ts）
// 同時屬於 team 或 admin 的人，以較大的權限為準。

const ADMIN_KEY = 'renmai.isAdmin';
const LIMITED_KEY = 'renmai.limited';

/** 只屬於 tech 群組（沒有 admin 或 team）的人，只能看到產品進度 */
export function isLimitedGroups(groups: readonly string[]): boolean {
  return groups.includes('tech') && !groups.includes('admin') && !groups.includes('team');
}

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // 存不了只影響離線時的顯示
  }
}

/** 記住上次確認過的身分：離線或剛開 App 還讀不到群組時沿用 */
export function cacheRole(groups: readonly string[]): { isAdmin: boolean; limited: boolean } {
  const role = { isAdmin: groups.includes('admin'), limited: isLimitedGroups(groups) };
  write(ADMIN_KEY, role.isAdmin);
  write(LIMITED_KEY, role.limited);
  return role;
}

export const cachedAdmin = (): boolean => read(ADMIN_KEY);
export const cachedLimited = (): boolean => read(LIMITED_KEY);

export function clearCachedRole(): void {
  try {
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(LIMITED_KEY);
  } catch {
    // 同上
  }
}
