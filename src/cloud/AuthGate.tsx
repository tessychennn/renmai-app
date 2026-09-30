import { useEffect, useState, type ReactNode } from 'react';
import { useSyncState } from '../sync/useSyncState';
import { cloudEnabled } from './config';
import LoginPage from './LoginPage';
import { hasSignedInBefore, markSignedIn, startCloudSync } from './start';

/**
 * 雲端登入閘門。
 * - 沒設定雲端（沒有 amplify_outputs.json）：直接放行，App 維持純本機。
 * - 這支手機從沒登入過：必須先登入（第一次設定需要網路）。
 * - 登入過但之後失效或沒網路：照樣進 App 用本機資料，只在需要時跳出可略過的登入畫面。
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  if (!cloudEnabled) return <>{children}</>;
  return <CloudAuthGate>{children}</CloudAuthGate>;
}

function CloudAuthGate({ children }: { children: ReactNode }) {
  const seen = hasSignedInBefore();
  const [phase, setPhase] = useState<'checking' | 'login' | 'ready'>(seen ? 'ready' : 'checking');
  const [reauth, setReauth] = useState(false);
  const sync = useSyncState();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cloud = await import('./amplify');
        if (await cloud.isSignedIn()) {
          markSignedIn();
          await startCloudSync();
          if (!cancelled) setPhase('ready');
        } else if (!cancelled) {
          if (seen) {
            setReauth(true);
            setPhase('ready');
          } else {
            setPhase('login');
          }
        }
      } catch {
        if (!cancelled) setPhase(seen ? 'ready' : 'login');
      }
    })();
    return () => {
      cancelled = true;
    };
    // 只在啟動時檢查一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步途中發現登入失效（例如換了密碼、帳號被停用）
  useEffect(() => {
    if (sync.status === 'auth-required') setReauth(true);
  }, [sync.status]);

  const onLoggedIn = () => {
    markSignedIn();
    setReauth(false);
    setPhase('ready');
    void startCloudSync();
  };

  if (phase === 'checking') return <div className="min-h-dvh bg-ground" />;
  if (phase === 'login') return <LoginPage onDone={onLoggedIn} />;
  return (
    <>
      {children}
      {reauth && <LoginPage onDone={onLoggedIn} onSkip={() => setReauth(false)} />}
    </>
  );
}
