import { Link } from 'react-router-dom';
import AccountMenu from '../cloud/AccountMenu';
import { useRole } from '../hooks/useRole';
import { PROGRESS_TEXT } from '../text/productProgress';

const iconButton =
  'flex h-9 w-9 items-center justify-center rounded-full text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** 設定：齒輪 */
function GearIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** 待辦設定：三條調整桿，和齒輪明顯不同 */
function SlidersIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1" />
      <circle cx="16" cy="6" r="2.2" />
      <circle cx="10" cy="12" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
    </svg>
  );
}

/**
 * 主要分頁標題列右上角的按鈕組，順序固定：帳號（有雲端才顯示）、待辦設定（只有待辦頁）、設定。
 * 「設定」永遠在最右邊，所有主要分頁位置一致。
 */
export default function HeaderActions({
  taskSettings = false,
  progressSettings = false,
}: {
  taskSettings?: boolean;
  progressSettings?: boolean;
}) {
  const role = useRole();
  return (
    <div className="flex items-center">
      <AccountMenu />
      {/* 產品進度設定：只有管理員能改，所以只給管理員看到入口 */}
      {progressSettings && role.admin && (
        <Link to="/progress/settings" aria-label={PROGRESS_TEXT.settingsButtonLabel} className={iconButton}>
          <SlidersIcon />
        </Link>
      )}
      {taskSettings && role.todo && (
        <Link to="/tasks/settings" aria-label="待辦設定" className={iconButton}>
          <SlidersIcon />
        </Link>
      )}
      {/* 設定頁（備份、匯出入、人脈設定）只有能用人脈記錄的人才有 */}
      {role.people && (
        <Link to="/settings" aria-label="設定" className={iconButton}>
          <GearIcon />
        </Link>
      )}
    </div>
  );
}
