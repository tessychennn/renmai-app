import { useEffect, useState } from 'react';
import { cloudEnabled } from '../cloud/config';
import { cacheRole, cachedAdmin, cachedLimited } from '../lib/roles';

export interface Role {
  /** 管理員可以修改待辦的選項設定。沒有啟用雲端時就是自己一個人用，視為管理員。 */
  isAdmin: boolean;
  /** 只能用產品進度的人（技術端）：畫面上只留產品進度。真正的限制在伺服器端。 */
  limited: boolean;
  /** 登入的信箱（沒有雲端或讀不到時是 undefined） */
  email?: string;
}

/**
 * 目前登入者的身分，取自 Cognito 的群組（admin、team、tech）。
 * 離線或讀不到時沿用上次已知的結果。真正的權限由 AWS 伺服器強制執行，
 * 這裡只是決定畫面上要不要顯示那些頁面與按鈕。
 */
export function useRole(): Role {
  const [role, setRole] = useState<Role>(() => ({
    isAdmin: cloudEnabled ? cachedAdmin() : true,
    limited: cloudEnabled ? cachedLimited() : false,
  }));

  useEffect(() => {
    if (!cloudEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const cloud = await import('../cloud/amplify');
        const [groups, email] = await Promise.all([cloud.currentGroups(), cloud.currentEmail()]);
        if (cancelled) return;
        if (groups === null) {
          setRole((r) => ({ ...r, email }));
          return;
        }
        setRole({ ...cacheRole(groups), email });
      } catch {
        // 讀不到身分就沿用快取
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return role;
}
