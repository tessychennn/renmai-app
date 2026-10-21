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

**預設分組**：App 啟動時自動補建「重要人物、餐飲相關、食品相關、品牌設計、暫無關聯」（固定識別碼，排在自訂分組前面）。已被刪除的不會再冒出來，使用者已有同名分組時不重複建立，兩支手機各自建立後同步會對成同一份。定義在 `src/data/defaultGroups.ts`。

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

## 11.5 雲端同步（兩人共用，已實作於 `cloud-sync` 分支）

第 10 節的「不要現在寫同步」條件已不成立：使用者確認有兩人共用需求且有 AWS。設計如下，細節見 `docs/AWS-SETUP.md`：

- **本機優先**：IndexedDB 仍是工作資料，離線可用；雲端在背景同步。展覽現場收訊差，不能依賴網路。
- **後端**：AWS Amplify Gen 2（Cognito 登入、AppSync＋DynamoDB、S3），東京區域。關閉自行註冊，只有管理員建立的兩個帳號能登入。
- **同步策略**：全量拉取＋上傳待上傳的變動；`updatedAt` 較新者整筆勝出；刪除用墓碑（`deletedAt`，不留個資）；先傳照片再傳人物；縮圖先下載、完整版點開才下載。
- **開關**：沒有 `amplify_outputs.json` 時雲端關閉，App 行為與純本機版完全相同。
- **不同步**：設定（目前場合、上次匯出時間）維持每支手機各自的。

### 客戶

聯絡中的名單，集中在第二個分頁「客戶」，專門記錄名單與備註。不會出現在待辦裡（曾經併入待辦的「業務開發」已經分開）。

- **兩種來源**：
  - 從人脈記錄標記：長按人物卡（桌面為右鍵）選一個狀態，或在新增、編輯人物時選「客戶」欄。每個人最多一筆，編號固定為 `client-人物編號`（`src/data/clientId.ts`），兩支手機各自建立也是同一筆；**名字不另存**，直接讀人物資料，改名不會對不上。人物卡上的標籤看客戶的狀態。
  - 在客戶頁直接新增：右下角「＋」，輸入名字、狀態、負責人、下次聯絡、備註。**不需要先有人脈記錄**，自己存名字（`name`），編號是隨機的。輸入名字時，人脈記錄裡同名、而且還不是客戶的人會列出來，點選就連結過去（變成上面那種）；也可以只存名字。沒有連結的客戶可以改名；刪除（不是「移出」）時名字與備註一併清掉。
- **狀態是固定的四個**：需聯繫（紅）、聯繫中（紫）、答應加入（綠）、後續處理（藍），清單與顏色在 `src/text/clients.ts`（檔案開頭有改法說明；已經有客戶用到的狀態不要改 id）。這份清單和待辦的狀態是分開的。
- **等級（輕重緩急）**：重要／潛在，清單在 `src/text/clients.ts`（`CLIENT_LEVELS`，排前面的越重要）；沒設定的排最後。列上有「等級」欄可以直接下拉修改，新增與編輯面板也有。
- 其他欄位：負責人（沿用待辦的成員選項，管理員在「待辦設定」維護）、下次聯絡、備註、完成（✓）與完成日。「完成」是勾選，不是狀態。
- 畫面：一個清單，每列有 ✓、名稱（下方一行備註與下次聯絡）、負責人與狀態（可直接下拉修改）；聯絡中／完成兩個檢視；負責人與狀態篩選；**排序**可以切換「重要等級」（預設，重要的在上面，同級再依下次聯絡）與「下次聯絡」，記住上次的選擇。點名稱開面板（狀態、負責人、下次聯絡、備註、「查看人脈資料」、「移出客戶」／「刪除」）。
- 刪除人物會一併刪除連結的客戶紀錄；移出客戶時墓碑不留名字與備註。
- **舊資料搬移**（啟動時與每次同步進來新資料後自動執行，可重複執行，需要同時能用人脈記錄與待辦）：
  - 人物上原本的 `collabStatus / collabOwner / collabNote`，以及「業務開發」裡編號為 `prospect-人物編號` 的待辦，都搬成客戶紀錄，待辦隨後被收掉（刪除）。客戶已存在（包含被移出的）就不再建立，移出的不會又冒出來。
  - **狀態轉換**：舊的待辦狀態轉成新的四個——需聯繫、未開始→需聯繫；聯繫中、進行中、等回覆→聯繫中；對不上的（例如已約時間）變成未設定。認不得的狀態編號（例如之後從清單拿掉的）原樣保留，不會被清掉。見 `src/lib/clients.ts`。

### 待辦

由原本的 Google 試算表（Apps Script）搬進 App，不含「總覽」與「紀錄」頁。

- 第三個分頁「待辦」：**看板**（依分類分區塊，手機一欄、電腦三欄）、**完成區**、**日曆**（依 Deadline），三個畫面共用負責人與分類篩選。
- 看板每項一排：✓、項目、負責人、Deadline、狀態，後三者可直接下拉修改（原生選單／日期選擇器蓋在小標籤上）。直接修改後那一列不會立刻跳位置，切換畫面或篩選時才重新排序。欄位寬度依區塊寬度調整（container query）。
- **排序**（待辦看板，分類區塊內）：Deadline（預設，近的在前、沒有的最後）、優先級、狀態、最新建立；記住上次的選擇。
- 任務欄位：名稱、分類、負責人、Deadline、優先級、狀態、備註、建立者、完成日期與完成者。逾期、今天、3 天內到期、「卡住」自動上色；優先級清單第一個＝最高（紅字）、最後一個＝最低（淡灰）。
- 選項（分類、成員、優先級、狀態）存在 `TaskOption`，任務用編號引用，改名不用同步舊任務。預設值沿用原試算表的設定區。
- **權限**：選項設定只有 Cognito `admin` 群組能改（AppSync 授權規則，伺服器強制）；任務所有登入者可讀寫。畫面上非管理員看不到編輯按鈕，只是方便，不是安全邊界。
- 預設選項只存在本機、不上傳（一般成員無寫入權限），同步引擎略過「未被修改過」的預設選項。
- 匯入：「待辦設定」頁貼上試算表匯出的 JSON（`docs/legacy-export.gs`），可重複匯入。

### 產品進度

和技術長溝通 App 修改進度的表格。分頁「產品進度」。

- **兩個分開的軸，由不同的人填**：營運優先級（營運端決定，只表示對營運多重要）與技術等級（技術端自己估的工作量）。刻意不合併成一個數字。
- **營運備註與技術備註分開兩欄**，兩邊各寫各的，不互相蓋掉。
- 欄位：名稱、大項目、營運優先級、技術等級、狀態、目標日期、營運備註、技術備註、完成日、提出者（登入信箱）。沒有負責人欄位。
- **大項目、營運優先級、技術等級、狀態都是管理員維護的選項**（`ProgressOption`，「產品進度設定」頁，管理員從產品進度頁右上角的調整桿進入）：新增、改名、上下移動排順序、選標籤顏色（灰、綠、黃、紅、紫、藍）、選填說明（顯示在下拉選單裡）；狀態可以勾選「代表完成」。刪除前會檢查有沒有項目在用，用得到就不能刪；至少要保留一個代表完成的狀態。**只有管理員能改，伺服器強制執行**，其他人只能看。第一次啟動時的預設選項在 `src/text/productProgress.ts`（編號沿用最初的代碼，如 P0、S、proposed），只存在本機、不上傳，管理員改過才會同步。
- **優先級與技術等級的順序有意義**：清單排前面的比較優先／比較簡單；摘要統計第一個優先級的數量；排序依清單順序。
- 每一列左邊有 ✓：打勾＝改成「代表完成」的第一個狀態並記下完成日（移到完成頁籤），取消打勾退回完成前面的那個狀態。沒有任何代表完成的狀態時不能打勾。
- 畫面：依大項目分區塊的清單（手機一欄、電腦三欄），每項一排，營運優先級、技術等級、狀態可直接下拉修改，目標日期在名稱下方一行小字（區塊夠寬時改成獨立欄位）；進行中／完成兩個檢視；大項目篩選；排序切換「營運優先／技術等級／目標日期」（大項目內排序，記住上次的選擇）；頂部摘要：進行中、待技術評估（沒填技術等級）、最高優先級、逾期。
- **不做矩陣視圖**（優先級 × 技術等級）。畫面上其他文字（標題、欄位名稱、提示）在 `src/text/productProgress.ts`。
- 資料表 `ProgressItem`、`ProgressOption`，本機 store `progress`、`progressOptions`（IndexedDB 版本 5），同步種類 `item`、`popt`。見 `src/lib/progress.ts`。

### 群組與權限

四個 Cognito 群組（`amplify/auth/resource.ts`），權限由 AWS 伺服器強制執行，畫面隱藏只是配合；一個帳號可以同時屬於多個群組，權限是各群組的合併：

| 群組 | 人脈、分組、客戶、照片 | 待辦 | 待辦選項 | 產品進度 | 產品進度選項 |
|---|---|---|---|---|---|
| `admin` 管理員 | 讀寫 | 讀寫 | 讀寫 | 讀寫 | 讀寫 |
| `team` 團隊成員 | 讀寫 | 讀寫 | 唯讀 | 讀寫 | 唯讀 |
| `tech` 技術端 | 看不到 | 讀寫 | 唯讀 | 讀寫 | 唯讀 |
| `todo` 待辦 | 看不到 | 讀寫 | 唯讀 | 看不到 | 看不到 |

- `tech` 就能用產品進度與待辦，看不到人脈與客戶；`todo` 是給只需要待辦、不需要產品進度的人。
- **沒有加入任何群組的帳號什麼資料都讀不到**，每個人都要加進至少一個群組。
- 畫面依群組只顯示有權限的頁面（`src/lib/roles.ts` 的 `accessOf`）：分頁列只列有權限的分頁（只剩一頁就不顯示分頁列）、其他網址導回第一個能進的頁面、沒有人脈權限的人沒有設定頁（備份、匯出入）。身分會快取，離線時沿用。
- **同步範圍**（`SyncScope`，`src/sync/engine.ts`）：引擎只同步有權限的資料——沒權限的資料伺服器會拒絕，所以根本不去讀、不去寫，其他待上傳的資料留著不動。權限擴大時（例如多加了一個群組）會用新的範圍重新初始化。
- 屬於群組的人，Cognito 會改用「群組角色」發放憑證，不再套用一般登入者的角色，所以照片儲存空間的權限要對群組各自授權（`amplify/storage/resource.ts`，只給 `admin`、`team`）。

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
