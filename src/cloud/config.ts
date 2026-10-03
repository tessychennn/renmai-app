// amplify_outputs.json 是 Amplify 部署後產生的連線資訊（帳號池、API 位址、儲存空間名稱），
// 全是公開識別碼，不含任何金鑰。檔案不存在＝雲端功能關閉，App 維持純本機。
const found = import.meta.glob('/amplify_outputs.json', { eager: true, import: 'default' });

export const amplifyOutputs = Object.values(found)[0] as Record<string, unknown> | undefined;

// 開發時用 VITE_DISABLE_CLOUD=1 關掉雲端（不需要登入就能測畫面）。正式建置不會設定它。
const disabled = import.meta.env.VITE_DISABLE_CLOUD === '1';

export const cloudEnabled = amplifyOutputs !== undefined && !disabled;
