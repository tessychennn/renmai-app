import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GlassHeader({
  title,
  back = false,
  right,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header
      className="glass fixed inset-x-0 top-0 z-10 border-b-[0.5px] border-hairline"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-14 items-center gap-1 px-3">
        {back && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="返回"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
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
        )}
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{title}</h1>
        {right}
      </div>
    </header>
  );
}

/** 配合 GlassHeader 的內容區上緣留白 */
export const HEADER_PAD = 'calc(env(safe-area-inset-top) + 72px)';
