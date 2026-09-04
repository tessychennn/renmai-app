# 人脈記錄

在活動認識的人，30 秒內拍照存檔，之後找得到、想得起來。純本機 PWA，資料不離開手機。

規格見 [SPEC.md](./SPEC.md)。

## 環境需求

- Node.js 20 以上
- npm

## 開發

```bash
npm install
npm run dev
```

## 部署到 iPhone（五步）

1. `npm run build` 產出 `dist/`
2. 推到 GitHub，用 [Vercel](https://vercel.com) 匯入（免費方案；Framework 選 Vite，其餘預設即可）
3. iPhone 用 **Safari**（不能用 Chrome）開 Vercel 給的網址
4. 分享按鈕 → 「加入主畫面」
5. 從主畫面圖示啟動，確認是全螢幕、沒有網址列

⚠️ 資料只存在這支手機上，記得定期在設定頁匯出備份。
