import { useNavigate } from 'react-router-dom';

export default function PagePlaceholder({ title, note }: { title: string; note: string }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh">
      <header
        className="glass fixed inset-x-0 top-0 z-10 border-b-[0.5px] border-hairline"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-2 px-3 pt-3 pb-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="返回"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M12.5 4 6.5 10l6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </header>
      <main
        className="px-5 text-center text-ink-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 160px)' }}
      >
        <p>{note}</p>
      </main>
    </div>
  );
}
