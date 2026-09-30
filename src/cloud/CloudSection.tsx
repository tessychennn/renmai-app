import { useEffect, useState } from 'react';
import ConfirmSheet from '../components/ConfirmSheet';
import { syncManager } from '../sync/manager';
import { useSyncState } from '../sync/useSyncState';
import { clearSignedIn, stopCloudSync } from './start';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CloudSection({ cardClass }: { cardClass: string }) {
  const sync = useSyncState();
  const [email, setEmail] = useState<string>();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    void import('./amplify').then((c) => c.currentEmail()).then(setEmail);
  }, []);

  const statusText = {
    idle: sync.lastSyncAt ? `已同步（${formatDateTime(sync.lastSyncAt)}）` : '尚未同步',
    syncing: '同步中⋯',
    offline: '目前沒有網路，恢復後會自動同步。',
    error: `同步發生問題：${sync.error ?? '未知錯誤'}`,
    'auth-required': '登入已失效，請重新登入。',
  }[sync.status];

  const signOut = async () => {
    stopCloudSync();
    const cloud = await import('./amplify');
    await cloud.cloudSignOut();
    clearSignedIn();
    location.reload();
  };

  return (
    <section className={cardClass}>
      <p className="font-medium">雲端同步</p>
      <p className="mt-0.5 text-sm text-ink-2">
        {email ? `登入帳號：${email}` : '你和另一位的資料會自動同步。'}
      </p>
      <p
        className={`mt-2 text-sm ${
          sync.status === 'error' || sync.status === 'auth-required'
            ? 'font-medium text-danger'
            : 'text-ink-2'
        }`}
      >
        {statusText}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void syncManager.sync()}
          disabled={sync.status === 'syncing'}
          className="flex-1 rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          立即同步
        </button>
        <button
          type="button"
          onClick={() => setConfirmSignOut(true)}
          className="flex-1 rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          登出
        </button>
      </div>

      <ConfirmSheet
        open={confirmSignOut}
        title="登出？"
        message="這支手機上的資料會保留，但登出後不會再同步。"
        actions={[{ label: '登出', danger: true, onClick: () => void signOut() }]}
        onClose={() => setConfirmSignOut(false)}
      />
    </section>
  );
}
