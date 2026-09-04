import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header
        className="glass fixed inset-x-0 top-0 z-10 border-b-[0.5px] border-hairline"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h1 className="text-2xl font-semibold">人脈記錄</h1>
          <Link
            to="/settings"
            aria-label="設定"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 2v2.2M10 15.8V18M18 10h-2.2M4.2 10H2M15.7 4.3l-1.6 1.6M5.9 14.1l-1.6 1.6M15.7 15.7l-1.6-1.6M5.9 5.9 4.3 4.3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>
        <div className="px-5 pb-3">
          <input
            type="search"
            placeholder="搜尋暱稱、場合、備註⋯"
            className="w-full rounded-xl border-[0.5px] border-hairline bg-white px-4 py-2.5 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>
      </header>

      <main
        className="px-5"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 128px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)',
        }}
      >
        <div className="mt-24 text-center text-ink-2">
          <p>還沒有人。</p>
          <p className="mt-1">按右下角的 + 記下第一個。</p>
        </div>
      </main>

      <Link
        to="/new"
        aria-label="新增人物"
        className="fixed right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </Link>
    </div>
  );
}
