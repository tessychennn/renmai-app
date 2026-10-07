import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ensureDefaultGroups, ensureDefaultTaskOptions } from './data';
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
void Promise.all([ensureDefaultGroups(), ensureDefaultTaskOptions()])
  .catch(() => undefined)
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
