import { NavLink } from 'react-router-dom';

const TABS = [
  {
    to: '/',
    label: '人脈記錄',
    end: true,
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
    to: '/collab',
    label: '合作機會',
    end: false,
    icon: (
      <path
        d="M4 7h16M4 12h16M4 17h10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    ),
  },
];

/** 下方分頁列：毛玻璃固定在底部，預留 home indicator 的安全區域 */
export default function TabBar() {
  return (
    <nav
      aria-label="主要分頁"
      className="glass fixed inset-x-0 bottom-0 z-20 border-t-[0.5px] border-hairline"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex h-14">
        {TABS.map((tab) => (
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
