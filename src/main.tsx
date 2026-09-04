import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// iOS 對加入主畫面的 PWA 較不會清除儲存，但仍要求持久化以求最大保障
if (navigator.storage?.persist) {
  void navigator.storage.persist();
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
