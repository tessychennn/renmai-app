import { useEffect, useState } from 'react';
import { cloudEnabled } from '../cloud/config';

const ADMIN_CACHE_KEY = 'renmai.isAdmin';

function readCachedAdmin(): boolean {
  try {
    return localStorage.getItem(ADMIN_CACHE_KEY) === '1';
  } catch {
    return false;
  }
}

export interface Role {
  /** 管理員可以修改待辦的選項設定。沒有啟用雲端時就是自己一個人用，視為管理員。 */
  isAdmin: boolean;
  /** 登入的信箱（沒有雲端或讀不到時是 undefined） */
  email?: string;
}

/**
 * 目前登入者的身分，取自 Cognito 的 admin 群組。
 * 離線或讀不到時沿用上次已知的結果。真正的權限由 AWS 伺服器強制執行，
 * 這裡只是決定畫面上要不要顯示編輯按鈕。
 */
export function useRole(): Role {
  const [role, setRole] = useState<Role>(() => ({
    isAdmin: cloudEnabled ? readCachedAdmin() : true,
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
        const isAdmin = groups.includes('admin');
        try {
          localStorage.setItem(ADMIN_CACHE_KEY, isAdmin ? '1' : '0');
        } catch {
          // 存不了只影響離線時的顯示
        }
        setRole({ isAdmin, email });
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
