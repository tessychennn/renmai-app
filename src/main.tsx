import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ensureDefaultGroups, ensureDefaultProgressOptions, ensureDefaultTaskOptions } from './data';
import { pruneLegacyStatuses } from './lib/pruneStatuses';
import { migrateToClients } from './lib/clients';
import { cachedAccess, FULL_ACCESS } from './lib/roles';
import { cloudEnabled } from './cloud/config';
import { syncEvents } from './sync/manager';
import { startUpdateCheck } from './lib/updateCheck';
import './index.css';

startUpdateCheck();

// iOS 對加入主畫面的 PWA 較不會清除儲存，但仍要求持久化以求最大保障
if (navigator.storage?.persist) {
  void navigator.storage.persist();
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

// 先補建預設分組再畫畫面，首頁第一次載入就看得到；失敗也不能擋住 App 啟動
// 原本「合作機會」存在人物上的資料、以及「業務開發」裡的合作對象，搬成客戶紀錄（可重複執行）。
// 另一支手機的資料同步進來後也要再跑一次。需要同時能用人脈記錄與待辦（收掉舊的待辦）才做。
const migrate = async () => {
  const access = cloudEnabled ? (cachedAccess() ?? FULL_ACCESS) : FULL_ACCESS;
  if (access.people && access.todo) await migrateToClients();
};
syncEvents.addEventListener('synced', () => void migrate().catch(() => undefined));
// 一次性清掉預設五個以外的狀態（管理員的裝置；有雲端時等第一次同步成功後）
syncEvents.addEventListener('completed', () => void pruneLegacyStatuses(true).catch(() => undefined));

void Promise.all([ensureDefaultGroups(), ensureDefaultTaskOptions(), ensureDefaultProgressOptions()])
  .then(() => migrate())
  .then(() => pruneLegacyStatuses())
  .catch(() => undefined)
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
