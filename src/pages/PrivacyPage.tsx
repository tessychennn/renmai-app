import { cloudEnabled } from '../cloud/config';
import GlassHeader, { HEADER_PAD } from '../components/GlassHeader';

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <GlassHeader title="隱私權政策" back />
      <main
        className="flex flex-col gap-3 px-5 text-ink-2"
        style={{ paddingTop: HEADER_PAD, paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}
      >
        {cloudEnabled ? (
          <>
            <p>
              本 App 的資料（人物、照片、分組）儲存在使用者手機上，並同步到專屬於本 App
              的雲端空間，僅限受邀的使用者登入讀取，不會提供給任何第三方。
            </p>
            <p>資料在傳輸與儲存時皆已加密。登出或清除本機資料，不會影響雲端上的資料。</p>
          </>
        ) : (
          <>
            <p>本 App 的所有資料（人物、照片、分組、設定）只儲存在你的裝置上。</p>
            <p>沒有帳號、沒有伺服器，也不會傳送任何資料到網路。</p>
          </>
        )}
        <p className="text-sm">（正式版隱私權政策將於上架前補充。）</p>
      </main>
    </div>
  );
}
