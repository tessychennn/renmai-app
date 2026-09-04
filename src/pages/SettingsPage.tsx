import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfirmSheet from '../components/ConfirmSheet';
import GlassHeader, { HEADER_PAD } from '../components/GlassHeader';
import { clearAllData, settingsRepo } from '../data';
import { exportAndDownload, importBackup, isBackupStale } from '../lib/backup';
import type { Settings } from '../data/types';

const cardClass =
  'rounded-2xl border-[0.5px] border-hairline bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [occasion, setOccasion] = useState('');
  const [busy, setBusy] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [message, setMessage] = useState('');
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void settingsRepo.get().then((s) => {
      setSettings(s);
      setOccasion(s.currentOccasion ?? '');
    });
  }, []);

  const saveOccasion = (value: string) => {
    setOccasion(value);
    const next: Settings = { ...(settings ?? {}), currentOccasion: value.trim() || undefined };
    setSettings(next);
    void settingsRepo.save(next);
  };

  const doExport = async () => {
    setBusy(true);
    setMessage('');
    try {
      await exportAndDownload();
      const next = await settingsRepo.get();
      setSettings(next);
      setMessage('已匯出。iPhone 上會跳出分享選單，可存到「檔案」或雲端硬碟。');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '匯出失敗，請再試一次。');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!importFile) return;
    setBusy(true);
    setMessage('');
    try {
      await importBackup(importFile, mode);
      navigate('/', { state: { toast: '匯入完成' } });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '匯入失敗，檔案可能已損壞。');
      setBusy(false);
    } finally {
      setImportFile(null);
    }
  };

  const doDeleteAll = async () => {
    setDeleteStep(0);
    setBusy(true);
    await clearAllData();
    navigate('/', { state: { toast: '已刪除所有資料' } });
  };

  return (
    <div className="min-h-dvh">
      <GlassHeader title="設定" back />

      <main
        className="flex flex-col gap-4 px-5"
        style={{
          paddingTop: HEADER_PAD,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)',
        }}
      >
        <section className={cardClass}>
          <label className="block">
            <span className="font-medium">目前場合</span>
            <span className="mt-0.5 block text-sm text-ink-2">
              設定後，新增人物時場合欄會自動帶入。活動進場前設定一次就好。
            </span>
            <input
              type="text"
              value={occasion}
              onChange={(e) => saveOccasion(e.target.value)}
              placeholder="例：2026 設計週"
              className="mt-3 w-full rounded-xl border-[0.5px] border-hairline bg-ground px-4 py-3 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            />
          </label>
        </section>

        <section className={cardClass}>
          <p className="font-medium">備份</p>
          <p className="mt-0.5 text-sm text-ink-2">
            資料只存在這支手機上，記得定期匯出備份。
          </p>
          {settings && (
            <p
              className={`mt-2 text-sm ${
                isBackupStale(settings.lastExportAt) ? 'font-medium text-danger' : 'text-ink-2'
              }`}
            >
              {settings.lastExportAt
                ? `上次匯出：${formatDateTime(settings.lastExportAt)}`
                : '從未匯出'}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void doExport()}
              disabled={busy}
              className="flex-1 rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              匯出備份
            </button>
            <button
              type="button"
              onClick={() => importInput.current?.click()}
              disabled={busy}
              className="flex-1 rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 font-medium disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            >
              匯入備份
            </button>
          </div>
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setImportFile(file);
              e.target.value = '';
            }}
          />
          {message && <p className="mt-3 text-sm text-ink-2">{message}</p>}
        </section>

        <section className={cardClass}>
          <Link
            to="/privacy"
            className="block py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            隱私權政策
          </Link>
          <button
            type="button"
            onClick={() => setDeleteStep(1)}
            disabled={busy}
            className="mt-3 block py-1 font-medium text-danger disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
          >
            刪除所有資料
          </button>
        </section>
      </main>

      <ConfirmSheet
        open={importFile !== null}
        title="匯入備份"
        message="「合併」保留現有資料，重複的以較新版本為準；「取代」會先清空再匯入。"
        actions={[
          { label: '合併', onClick: () => void doImport('merge') },
          { label: '取代（清空後匯入）', danger: true, onClick: () => void doImport('replace') },
        ]}
        onClose={() => setImportFile(null)}
      />

      <ConfirmSheet
        open={deleteStep === 1}
        title="刪除所有資料？"
        message="所有人物、照片、分組都會消失。"
        actions={[{ label: '繼續', danger: true, onClick: () => setDeleteStep(2) }]}
        onClose={() => setDeleteStep(0)}
      />

      <ConfirmSheet
        open={deleteStep === 2}
        title="真的確定嗎？"
        message="此動作無法復原。如果還沒匯出備份，現在取消還來得及。"
        actions={[{ label: '刪除所有資料', danger: true, onClick: () => void doDeleteAll() }]}
        onClose={() => setDeleteStep(0)}
      />
    </div>
  );
}
