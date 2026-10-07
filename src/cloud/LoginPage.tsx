import { useState } from 'react';

const fieldClass =
  'w-full rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

export default function LoginPage({
  onDone,
  onSkip,
}: {
  onDone: () => void;
  /** 有值時顯示「先離線使用」：登入失效但手機上已有資料的情況 */
  onSkip?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'login' | 'new-password'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      const cloud = await import('./amplify');
      setError(cloud.friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const cloud = await import('./amplify');
      const outcome = await cloud.cloudSignIn(email, password);
      if (outcome === 'signed-in') onDone();
      else setStep('new-password');
    });
  };

  const submitNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const cloud = await import('./amplify');
      await cloud.cloudSetNewPassword(newPassword);
      onDone();
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-ground px-6"
      role="dialog"
      aria-modal="true"
      aria-label="登入"
    >
      <div className="glass w-full max-w-sm rounded-3xl border-[0.5px] border-hairline p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
        <h1 className="text-2xl font-semibold">福天庭</h1>
        <p className="mt-1 text-sm text-ink-2">
          {step === 'login'
            ? '登入後，你和另一位的資料會自動同步。'
            : '第一次登入，請設定你自己的新密碼。'}
        </p>

        {step === 'login' ? (
          <form onSubmit={submitLogin} className="mt-5 flex flex-col gap-3">
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="信箱"
              required
              className={fieldClass}
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密碼"
              required
              className={fieldClass}
            />
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {busy ? '登入中⋯' : '登入'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitNewPassword} className="mt-5 flex flex-col gap-3">
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密碼"
              required
              minLength={8}
              className={fieldClass}
            />
            <p className="text-xs text-ink-2">至少 8 個字元，需含大寫、小寫、數字與符號。</p>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {busy ? '設定中⋯' : '設定並登入'}
            </button>
          </form>
        )}

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-4 w-full text-center text-sm text-ink-2 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            先離線使用，之後再登入
          </button>
        )}
      </div>
    </div>
  );
}
