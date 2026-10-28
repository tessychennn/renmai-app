// 登入者的身分（Cognito 群組）決定能用哪些頁面。權限由 AWS 伺服器強制執行（見 amplify/data/resource.ts），
// 這裡只是決定畫面上要顯示哪些頁面與按鈕，以及同步時要去讀哪些資料。
//
//   admin  管理員：全部功能，並且是唯一能修改選項設定的人
//   team   團隊成員：人脈記錄、客戶、待辦、產品進度
//   tech   技術端：產品進度與待辦
//   todo   只有待辦（給不需要產品進度的人）
//
// 一個帳號可以同時屬於多個群組，權限是各群組的合併。

export interface Access {
  /** 管理員：可以修改各種選項設定 */
  admin: boolean;
  /** 人脈記錄、客戶（含設定頁、備份匯出入） */
  people: boolean;
  todo: boolean;
  progress: boolean;
}

export const FULL_ACCESS: Access = { admin: true, people: true, todo: true, progress: true };
export const NO_ACCESS: Access = { admin: false, people: false, todo: false, progress: false };

export function accessOf(groups: readonly string[]): Access {
  const admin = groups.includes('admin');
  const team = groups.includes('team');
  return {
    admin,
    people: admin || team,
    todo: admin || team || groups.includes('todo') || groups.includes('tech'),
    progress: admin || team || groups.includes('tech'),
  };
}

const ACCESS_KEY = 'renmai.access';

/** 記住上次確認過的身分：離線或剛開 App 還讀不到群組時沿用 */
export function cacheAccess(groups: readonly string[]): Access {
  const access = accessOf(groups);
  try {
    localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  } catch {
    // 存不了只影響離線時的顯示
  }
  return access;
}

/** 上次確認過的身分；沒有記錄（還沒登入過）回傳 undefined */
export function cachedAccess(): Access | undefined {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) {
      // 舊版只記「是不是管理員」與「是不是只能用產品進度」
      if (localStorage.getItem('renmai.isAdmin') === '1') return FULL_ACCESS;
      if (localStorage.getItem('renmai.limited') === '1') return { ...NO_ACCESS, progress: true };
      return undefined;
    }
    const v = JSON.parse(raw) as Partial<Access>;
    return {
      admin: v.admin === true,
      people: v.people === true,
      todo: v.todo === true,
      progress: v.progress === true,
    };
  } catch {
    return undefined;
  }
}

export function clearCachedRole(): void {
  try {
    localStorage.removeItem(ACCESS_KEY);
    // 舊版留下的記號
    localStorage.removeItem('renmai.isAdmin');
    localStorage.removeItem('renmai.limited');
  } catch {
    // 同上
  }
}

/** 同步範圍：有權限的資料才去讀寫（沒權限的資料伺服器會拒絕） */
export function syncScopeOf(access: Access): { people: boolean; todo: boolean; progress: boolean } {
  return { people: access.people, todo: access.todo, progress: access.progress };
}

/**
 * 打開 App 時的第一個頁面（也是網址不存在或沒有權限時導回的頁面）：優先待辦，
 * 沒有待辦權限的人依序是產品進度、人脈記錄。
 */
export function homeRoute(access: Access): string {
  if (access.todo) return '/tasks';
  if (access.progress) return '/progress';
  if (access.people) return '/people';
  return '/tasks';
}
