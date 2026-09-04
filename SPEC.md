# 人脈記錄 App — 開發規格（修訂版）

## 0. 給執行者的話

這是一份可以直接開工的規格。第一階段目標是做出一個我自己能在 iPhone 上天天使用的 PWA，不上架、不做後端、不做登入。

但這個 App 未來要上架 App Store，所以第一階段的每個技術決定都必須不擋住那條路。文件中標記 🔒 的段落是為了未來鋪路的約束，即使現在看起來多餘也請照做。

介面全部使用繁體中文。

---

## 1. 產品定義

**解決的問題**：在活動、展覽、聚會認識很多人，收到一堆明信片和名片，加了通訊軟體好友卻記不得誰是誰、在哪認識的。三個月後翻開好友列表，一半的人只剩一個陌生的暱稱。

**核心動作**：認識一個人 → 30 秒內拍照存檔 → 之後找得到、想得起來。

---

## 2. 技術選型

| 項目 | 選擇 | 理由 |
|---|---|---|
| 建置工具 | Vite | 產出純靜態 SPA，是 Capacitor 最單純的輸入 |
| 框架 | React 18 + TypeScript | |
| 樣式 | Tailwind CSS | |
| 路由 | React Router，HashRouter | 🔒 Capacitor 的 `capacitor://` 環境下 BrowserRouter 會有路徑問題 |
| 本機儲存 | IndexedDB（用 `idb` 套件包裝） | localStorage 上限約 5MB，放不下照片 |
| 部署 | Vercel（免費方案） | iPhone 需要 HTTPS 才能安裝 PWA |

🔒 不要使用 Next.js。App Router 的 server component、middleware、image optimization 都無法在 Capacitor 靜態輸出中運作，之後要拆會很痛苦。

🔒 不要引入任何需要伺服器的功能。第一階段所有資料都在裝置上。

---

## 3. 架構：資料層抽象

這是整份文件最重要的部分。

現在資料存在 IndexedDB，未來上架後會需要雲端同步（Supabase），照片也會改存 Capacitor Filesystem。如果 UI 直接呼叫 IndexedDB，到時候整個 App 都要重寫。

所以定義介面，UI 只依賴介面：

```ts
// src/data/types.ts

export interface PersonRepo {
  list(filter?: PersonFilter): Promise<Person[]>;
  get(id: string): Promise<Person | null>;
  save(person: Person): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface PhotoRepo {
  /** 存入一張圖（內部同時產生完整版與縮圖），回傳 photoId */
  put(blob: Blob): Promise<string>;
  /** 取得可放進 <img src> 的 URL；列表一律用 'thumb'，詳細頁用 'full' */
  getURL(id: string, variant?: 'full' | 'thumb'): Promise<string>;
  /** 釋放 getURL 產生的資源 */
  releaseURL(url: string): void;
  remove(id: string): Promise<void>;
}

export interface GroupRepo {
  list(): Promise<Group[]>;
  save(group: Group): Promise<void>;
  remove(id: string): Promise<void>;
}
```

實作放在 `src/data/indexeddb/`，透過 `src/data/index.ts` 單一出口注入：

```ts
export const personRepo: PersonRepo = new IndexedDBPersonRepo();
export const photoRepo: PhotoRepo = new IndexedDBPhotoRepo();
export const groupRepo: GroupRepo = new IndexedDBGroupRepo();
```

🔒 任何 React component 都不得直接 import `idb` 或呼叫 `indexedDB`。一律透過上面三個 repo。未來替換實作時，只改 `src/data/index.ts` 這一行。

`releaseURL` 現在會呼叫 `URL.revokeObjectURL`，未來 Capacitor 版本回傳的是 `file://` 路徑，這個方法就變成 no-op。介面預留是為了 UI 不用改。

請提供 `usePhotoURL(photoId, variant)` hook，在 unmount 時自動呼叫 `releaseURL`，避免記憶體洩漏。

---

## 4. 資料模型

```ts
interface Person {
  id: string;              // crypto.randomUUID()
  displayName: string;     // 必填，建議照抄對方的顯示名稱
  lineName?: string;       // 選填；UI 標籤寫「聯絡帳號」（見第 8 節商標條款）
  avatarPhotoId?: string;  // 必須指向 photoIds 中的其中一張
  photoIds: string[];      // 明信片、名片、合照
  groupIds: string[];
  occasion?: string;       // 認識場合，例：2026 設計週
  metDate?: string;        // ISO date，預設今天
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface Group {
  id: string;
  name: string;
  color: string;           // hex
  order: number;
}

interface PhotoRecord {
  id: string;
  blob: Blob;              // 🔒 僅 IndexedDB 實作使用，不可外洩到 UI 層
  thumbBlob: Blob;         // 長邊 320px 縮圖
  width: number;
  height: number;
  createdAt: string;
}

interface Settings {
  currentOccasion?: string;  // 「目前場合」，新增時自動帶入
  lastExportAt?: string;     // 上次匯出時間，設定頁顯示、逾期提醒用
}
```

IndexedDB schema：`persons`、`groups`、`photos`、`settings` 四個 object store。`persons` 建立 `occasion`、`updatedAt` 索引。版本號從 1 開始，寫好 `onupgradeneeded` 的升級路徑。

---

## 5. 功能規格

### 5.1 首頁

人物列表。

列表以卡片呈現，每張顯示大頭貼縮圖、暱稱、場合、分組色點。預設依 `createdAt` 新到舊排序。

頂部有搜尋框，即時比對 `displayName`、`occasion`、`note`、`lineName`。

分組篩選用橫向捲動的標籤列，可多選。

空狀態不要只寫「沒有資料」，要給出下一步：「還沒有人。按右下角的 + 記下第一個。」

### 5.2 新增／編輯

右下角固定的 + 按鈕進入。

欄位順序刻意設計成照片優先，因為使用者通常是剛拿到明信片、手上還拿著手機的當下：

1. 照片區（可多張，第一張預設為大頭貼，可切換）
2. 暱稱（必填）
3. 場合（自動帶入 Settings 的 `currentOccasion`）
4. 認識日期（預設今天）
5. 分組（多選，可當場新增）
6. 備註（多行）
7. 聯絡帳號（選填，收在「更多」裡，對應 `lineName` 欄位）

照片輸入用兩個入口：

```html
<input type="file" accept="image/*" capture="environment">  <!-- 直接開相機 -->
<input type="file" accept="image/*" multiple>               <!-- 從相簿選 -->
```

儲存後回到列表，顯示 toast「已記下 王小明」。

### 5.3 詳細頁

大圖輪播、所有欄位、編輯、刪除。

刪除人物時要一併刪除其照片，避免孤兒資料佔空間。

刪除某張照片時，若它是目前的大頭貼，`avatarPhotoId` 自動指向剩餘照片的第一張；照片全刪光則清空。

### 5.4 目前場合

設定頁可設定「目前場合」。設定後，新增人物時場合欄自動填入。

這是為了活動當天的效率：進場前設定一次，當天記十個人都不用重打。

### 5.5 匯出與匯入

⚠️ 這是本機版唯一的資料保險，必須實作，不可延後。

**匯出**：產生單一 `.json` 檔，照片轉 base64 內嵌。透過 `<a download>` 觸發下載。iOS Safari 會跳出分享選單，可存到「檔案」或雲端硬碟。

⚠️ 實作限制：不可對整包資料一次 `JSON.stringify`。照片多的時候字串會達數十 MB，iOS Safari 有機會記憶體不足閃退。逐張照片序列化後 push 進陣列，最後用 `new Blob(parts, { type: 'application/json' })` 組裝。

**匯入**：選擇 json 檔，詢問「合併」或「取代」。合併時，`persons`、`groups`、`photos` 一律以 `id` 判斷重複，重複者以 `updatedAt` 較新的一方為準。

匯出成功後更新 `Settings.lastExportAt`，設定頁顯示上次匯出時間；超過 14 天未匯出，在首頁顯示提醒橫幅。

---

## 6. 照片處理

iPhone 拍出來的照片動輒 3–5MB，直接存會很快撐爆容量並拖慢載入。

存檔前一律壓縮：

1. 讀進 canvas，長邊縮到最多 1600px（等比例）
2. 匯出 JPEG，quality 0.82
3. 存壓縮後的 Blob

同時產生一張長邊 320px 的縮圖存進同一筆 `PhotoRecord`，列表只載縮圖。這對捲動流暢度影響很大。

**HEIC 注意**：iOS Safari 透過 file input 取得的照片通常已自動轉為 JPEG，但不保證。若 `canvas.drawImage` 失敗，顯示可理解的錯誤訊息（「這張照片格式不支援，請改用相機拍攝」），不要靜默失敗。

**自動裁切（掃描效果）**：用相機拍的照片自動偵測明信片／名片的四邊形範圍，透視校正後裁下（OpenCV.js，約 10MB，動態載入＋SW 快取，離線可用）。偵測不到就保留原圖；裁切後照片上有「還原」退路。只套用在「拍照」入口，相簿選的照片不動。邏輯在 `src/lib/documentScan.ts`。🔒 Capacitor 階段換成 iOS VisionKit 文件掃描。

🔒 壓縮邏輯獨立成 `src/lib/image.ts`，不要寫在 component 裡。Capacitor 階段這裡會換成原生實作。

---

## 7. iOS PWA 設定

必須做到，否則加到主畫面後行為會不對：

**manifest.json**

```json
{
  "name": "人脈記錄",
  "short_name": "人脈",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F5F5F7",
  "theme_color": "#F5F5F7",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**index.html**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

`black-translucent` 讓內容延伸到狀態列底下，頂部毛玻璃列才能一路糊到螢幕最上緣。代價是頂欄必須自己加 `padding-top: env(safe-area-inset-top)`。

**安全區域**：頂欄加 `padding-top: env(safe-area-inset-top)`；底部導覽與固定按鈕加 `padding-bottom: env(safe-area-inset-bottom)`，否則會被 iPhone 的 home indicator 蓋住。

**輸入框字級至少 16px**，小於這個數字 iOS 會在聚焦時自動放大整個頁面。

**要求持久化儲存**：App 啟動時呼叫一次

```js
if (navigator.storage?.persist) await navigator.storage.persist();
```

⚠️ Safari 對未加到主畫面的網站有儲存清除機制，加到主畫面的 PWA 待遇較好但仍非絕對保證。這是第 5.5 節匯出功能必須存在的理由 — 請在設定頁用一句白話告訴使用者：「資料只存在這支手機上，記得定期匯出備份。」

**Service Worker**：做一個最小版本，快取 app shell（HTML/JS/CSS）即可，讓沒網路時也開得起來。資料本來就在本機，不需要快取 API。

---

## 8. 設計方向

主題是**毛玻璃 × 白色簡約**。乾淨、留白、高級感——接近 iOS 原生系統介面的質感，不是企業後台。

### 核心原則：玻璃是框架的材質，不是內容的材質

毛玻璃只有在背後有內容穿過時才存在。做法：

- **內容層**：白卡片放在極淺灰底（`#F5F5F7`）上，捲動時從玻璃層底下穿過
- **玻璃層**：只用在固定不動的元素——頂部搜尋列、底部工具列、彈出的 sheet、toast

**列表卡片本身禁用毛玻璃。** 幾十張卡片各自跑 `backdrop-filter` 會讓 iPhone 捲動掉幀，直接違反驗收清單的流暢度要求。

### 色彩 token

| Token | 值 | 用途 |
|---|---|---|
| 底色 | `#F5F5F7` | 頁面背景，讓白卡片浮得出來 |
| 卡片白 | `#FFFFFF` | 人物卡片、輸入區塊 |
| 主文字 | `#1D1D1F` | 也是主按鈕底色（黑按鈕，白字） |
| 次文字 | `#6E6E73` | 場合、日期；此灰在白底上剛好過 WCAG AA，不可再淡 |
| 髮絲線 | `rgba(0,0,0,0.08)` | 分隔線、卡片邊界 |
| 警示紅 | `#B4372E` | 僅用於刪除與備份提醒 |

分組色點由使用者自訂，是介面中唯一的彩色來源。

### 毛玻璃配方

```css
.glass {
  background: rgba(255, 255, 255, 0.72);
  -webkit-backdrop-filter: blur(20px) saturate(180%); /* iOS Safari 必加前綴 */
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08); /* 頂欄用；底欄改 border-top */
}

/* 不支援時退回實色，不能讓文字疊在內容上 */
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: rgba(255, 255, 255, 0.97); }
}

/* 使用者關閉系統透明度時尊重設定 */
@media (prefers-reduced-transparency: reduce) {
  .glass {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    background: rgba(255, 255, 255, 0.97);
  }
}
```

### 字體

全 App 只用 **Noto Sans TC**。層次靠字重（標題 600、內文 400）與字級拉開，不換字體。

### 其他規則

- 卡片用髮絲線邊界＋極淡陰影（`0 1px 3px rgba(0,0,0,0.06)`），不要厚重陰影
- 避免：ALL CAPS 標籤、每個區塊都淡入上滑的進場動畫、按鈕文字後面加箭頭
- 動效只用在回應操作的地方：新增後卡片滑入、刪除時卡片收合
- 品質底線：鍵盤 focus 可見、`prefers-reduced-motion` 要尊重、色彩對比達 WCAG AA

🔒 App 名稱、圖示、介面文案都不得出現「LINE」字樣或綠色對話泡泡造型。這是商標問題，會直接導致上架被拒。`lineName` 只是內部欄位名，UI 標籤一律寫「聯絡帳號」。

---

## 9. 部署與 iPhone 試用

1. `npm run build` 產出 `dist/`
2. 推到 GitHub，用 Vercel 匯入（免費方案，靜態站台足夠）
3. iPhone 用 **Safari**（不能用 Chrome）開網址
4. 分享按鈕 → 加入主畫面
5. 從主畫面圖示啟動，確認是全螢幕、沒有網址列

請在 README 寫下這五步，並附上必要的環境需求。

---

## 10. 為未來上架保留的接口

以下現在不要實作，但架構上不能擋住：

| 未來需求 | 現在要做的準備 |
|---|---|
| Capacitor 打包 | 純靜態 SPA、HashRouter、無 server 依賴 |
| 照片改存原生檔案系統 | PhotoRepo 介面已抽象 |
| 雲端同步 | PersonRepo 介面已抽象；所有實體都有 `updatedAt` 供衝突比對 |
| 隱私政策（上架必要） | 設定頁預留「隱私權政策」項目，現在連到一個佔位頁面 |
| 帳號與資料刪除（上架必要） | 設定頁需有「刪除所有資料」，含二次確認 |

🔒 不要為了未來而現在就寫同步邏輯或登入。那是三倍的工作量，而且會在你還沒確定真實需求前就把設計鎖死。

---

## 11. 驗收清單

- [ ] iPhone 加到主畫面後，全螢幕開啟且圖示正常
- [ ] 拍照新增一個人，30 秒內完成
- [ ] 關閉 App 再開啟，資料仍在
- [ ] 開飛航模式，App 正常開啟與使用
- [ ] 匯出 json、清除資料、再匯入，資料完整還原（含照片）
- [ ] 存入 50 張照片後，列表捲動仍然流暢
- [ ] 超過 14 天未匯出時，首頁出現備份提醒橫幅
- [ ] 沒有任何 component 直接呼叫 indexedDB 或 import idb
- [ ] 全部介面為繁體中文，無 LINE 商標字樣
- [ ] 頂部玻璃列延伸到狀態列、底部按鈕未被 home indicator 遮蔽

---

## 12. 建議實作順序

1. 專案骨架、Tailwind、HashRouter、PWA manifest → 先確認 iPhone 裝得起來
2. 資料層介面與 IndexedDB 實作（含單元測試）
3. 圖片壓縮工具
4. 新增／編輯頁
5. 列表、搜尋、分組篩選
6. 詳細頁
7. 匯出／匯入
8. 設定頁
9. 設計打磨

**第 1 步做完就先部署一次，在 iPhone 上驗證安裝流程。不要等全部做完才第一次上手機。**
