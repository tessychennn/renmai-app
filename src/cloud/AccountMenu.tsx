import { useState } from 'react';
import ConfirmSheet from '../components/ConfirmSheet';
import { cloudEnabled } from './config';
import { signOutAndReload } from './signOutFlow';

/**
 * 各主要分頁右上角的帳號按鈕：點開看目前登入的帳號，並可以登出。
 * 沒有啟用雲端（不需要登入）時不顯示。
 */
export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string>();

  if (!cloudEnabled) return null;

  const show = () => {
    setOpen(true);
    void import('./amplify').then((c) => c.currentEmail()).then(setEmail);
  };

  return (
    <>
      <button
        type="button"
        aria-label="帳號與登出"
        onClick={show}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M3.5 16.5c.6-3 3-4.5 6.5-4.5s5.9 1.5 6.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <ConfirmSheet
        open={open}
        title="帳號"
        message={`${email ? `登入帳號：${email}。` : ''}登出後這支手機上的資料會保留，但不會再同步。`}
        actions={[{ label: '登出', danger: true, onClick: () => void signOutAndReload() }]}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
