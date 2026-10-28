import { NavLink } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { PROGRESS_TEXT } from '../text/productProgress';

type Need = 'people' | 'todo' | 'progress';

const TABS: { to: string; label: string; end: boolean; need: Need; icon: React.ReactNode }[] = [
  {
    to: '/tasks',
    label: '待辦',
    end: false,
    need: 'todo',
    icon: (
      <path
        d="m4 7 1.5 1.5L8 6M4 13l1.5 1.5L8 12M11 7.5h9M11 13.5h9M4 19h16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    to: '/people',
    label: '人脈記錄',
    end: false,
    need: 'people',
    icon: (
      <path
        d="M4 20c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    to: '/clients',
    label: '客戶',
    end: false,
    need: 'people',
    icon: (
      <path
        d="M16 20c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4M9.5 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20c0-1.9-1.3-3.5-3-3.9M15.5 5.7a3.5 3.5 0 0 1 0 6.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    to: '/progress',
    label: PROGRESS_TEXT.tabLabel,
    end: false,
    need: 'progress',
    icon: (
      <path
        d="M4 20V10M10 20V4M16 20v-7M22 20H2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

/** 下方分頁列：毛玻璃固定在底部，預留 home indicator 的安全區域 */
export default function TabBar() {
  const role = useRole();
  // 只顯示這個帳號有權限的頁面；只有一頁可用時（例如技術端只有產品進度）不需要分頁列
  const tabs = TABS.filter((tab) => role[tab.need]);
  if (tabs.length < 2) return null;
  return (
    <nav
      aria-label="主要分頁"
      className="glass fixed inset-x-0 bottom-0 z-20 border-t-[0.5px] border-hairline"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex h-14">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink ${
                  isActive ? 'font-semibold text-ink' : 'text-ink-2'
                }`
              }
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {tab.icon}
              </svg>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** 有分頁列的頁面，內容底部要留的空間（分頁列高度 56px＋安全區域＋一點呼吸） */
export const TAB_BAR_PAD = 'calc(env(safe-area-inset-bottom) + 72px)';
