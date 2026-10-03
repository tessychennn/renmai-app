# 雲端同步：AWS 部署步驟

兩個人共用同一份人脈資料。後端（登入、資料表、照片儲存）由 AWS Amplify 從 GitHub 自動建置，
**不需要在電腦上安裝 AWS 工具或設定金鑰**，全部在 AWS 網頁上操作。

網站本身繼續放在 Vercel，網址不變，所以你們手機上現有的資料會保留，第一次登入後自動上傳。

## 開始前

1. **兩支手機都先匯出一份備份**（設定 → 匯出備份，存到「檔案」）。這是這次升級唯一需要的保險。
   這版會把手機本機資料庫升級一個版本，升級後無法降回舊版。
2. 準備好 AWS 帳號的登入權限（能建立資源的管理員身分即可）。
3. 決定兩個人的信箱，之後會在 AWS 上替你們各建一個帳號。

## 步驟一：把程式合併到 main

在 `cloud-sync` 分支確認沒問題後合併到 `main`。合併後 Vercel 會自動部署新版，
但在放入 `amplify_outputs.json`（步驟四）之前，雲端功能是關閉的，App 行為和現在完全一樣。

## 步驟二：在 AWS 建立後端

1. 登入 [AWS 主控台](https://console.aws.amazon.com/)，右上角地區選 **亞太（東京）ap-northeast-1**。
2. 搜尋並進入 **AWS Amplify**。
3. 按 **Create new app**（或 Deploy an app）→ 選 **GitHub** → Next。
4. 依畫面授權 GitHub，並允許存取 `renmai-app` 這個儲存庫。
5. 選擇儲存庫 `renmai-app`、分支 `main` → Next。
6. 建置設定會自動抓到專案裡的 `amplify.yml`，直接 Next → **Save and deploy**。
7. 等待約 5 到 10 分鐘，直到 Provision、Build、Deploy、Verify 全部打勾。

### 部署用 IAM 角色

1. IAM → Roles → Create role → AWS service → Use case 選 **Amplify - Backend Deployment**，
   名稱 `AmplifyBackendDeployRole`。
2. 確認附有 **AmplifyBackendDeployFullAccess**（或 AdministratorAccess-Amplify）。
3. 再加一個 inline policy（名稱 `CdkBootstrapAccess`），讓 CDK 能讀取初始化狀態並切換到自己的部署角色，
   缺少時會出現 `not authorized to perform: ssm:GetParameter`：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters"],
      "Resource": "arn:aws:ssm:*:*:parameter/cdk-bootstrap/*"
    },
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::*:role/cdk-*"
    }
  ]
}
```

4. Amplify → App settings → General settings → Edit → Service role 選這個角色。

### 建置失敗時

Amplify → 你的 app → 分支 `main` → 點失敗的那次建置 → 展開紅色叉叉的那一步（Provision、Build 或 Deploy）→
複製最後幾十行的紅色錯誤訊息。常見原因：

- **`npm ci` 報 `Missing ... from lock file`**：已用 `amplify.yml` 裡的 `npm install` 避開，不需處理。
- **Node 版本太舊**：`amplify.yml` 已固定用 Node 20。
- **權限不足（AccessDenied、no permission）**：Amplify 需要一個「部署後端」用的服務角色
  （Service role），到 Amplify → Hosting → App settings → General settings 檢查。
  不要用 `AmplifySSRLoggingRole`，那只是寫網站日誌用的，沒有建立後端的權限。
  自己建立角色的方式見下面「部署用 IAM 角色」。
- **重新部署**：修好後在同一頁按 Redeploy this version，或直接 push 一個新 commit。

> Amplify 也會替網站放一份在 `xxx.amplifyapp.com`。**不要用那個網址**，
> 不同網址的資料是分開的，你們繼續用 Vercel 的網址。

## 步驟三：建立你們兩個人的帳號

系統已關閉自行註冊，只有你在這裡建立的帳號能登入。

1. AWS 主控台搜尋 **Cognito** → User pools → 點進名稱含 `amplifyAuth` 的那個。
2. Users → **Create user**。
3. 選 Send an email invitation 或 Don't send（自己告訴對方臨時密碼也行）。
4. 輸入信箱，勾選 **Mark email address as verified**，設定一組**臨時密碼**。
5. 再替另一位重複一次。

第一次登入時，App 會要求換成自己的新密碼（至少 8 字元，含大寫、小寫、數字、符號）。

## 步驟四：把連線設定放進專案

1. Amplify 主控台 → 你的 app → 分支 `main` → **Deployed backend resources** →
   **Download amplify_outputs.json**。
2. 把檔案放在專案最外層（和 `package.json` 同一層）。
3. commit 並 push。這個檔案只有公開的識別碼（帳號池 ID、API 位址、bucket 名稱），沒有任何金鑰，可以放進儲存庫。

Vercel 部署完成後，雲端功能就開了。

## 步驟五：兩支手機開始使用

1. **完全關掉 App 再重開**（上滑移除）。
2. 出現登入畫面，輸入信箱與臨時密碼，設定新密碼。
3. 首頁標題旁會出現一個小圓點：脈動＝同步中、淡色＝已同步、空心＝沒網路、紅色＝有問題。
4. 第一支手機登入後，現有資料會自動上傳；第二支手機登入後會把資料下載下來。

## 驗收清單

- [ ] 手機 A 新增一個人（含照片），手機 B 在一分鐘內看得到
- [ ] 手機 B 編輯該人的備註，手機 A 看得到新備註
- [ ] 手機 A 刪除該人，手機 B 也消失
- [ ] 手機 A 開飛航模式新增一個人，關掉飛航模式後手機 B 看得到
- [ ] 手機 B 點開手機 A 新增的照片，能看到完整大圖
- [ ] 設定頁顯示登入帳號與上次同步時間

## 之後改了後端要做的事（例如新增資料欄位）

只有改到 `amplify/` 資料夾（資料表欄位、儲存空間設定）才需要，改畫面或功能不用。

1. push 之後，Amplify 會自動重新部署後端，等 Build 全部打勾。
2. 重新下載 `amplify_outputs.json`（Amplify → 分支 `main` → Deployed backend resources），
   覆蓋專案裡的舊檔，commit 並 push。
3. 在這兩步之間，App 會顯示「同步發生問題：後端還沒更新到…」，這是刻意的保護：
   舊的 outputs 不認得新欄位，硬傳會讓新欄位被默默丟掉、本機卻以為已經同步成功。
   手機上的資料都還在，第 2 步完成後會自動補傳，不會遺失。

> 目前這個機制只保護「合作機會」欄位。之後再加欄位時，同樣要照這個順序做。

## 本機開發

```bash
# 不想登入就能測畫面：關閉雲端（PowerShell）
$env:VITE_DISABLE_CLOUD = '1'; npm run dev
```

## 費用

兩個人使用、資料上百筆的規模，Cognito、DynamoDB、S3、AppSync 通常都落在免費額度內或每月幾美分。
建議在 AWS Billing 設一個預算提醒（例如每月 5 美元）以防萬一。

## 出問題時退回

刪掉專案裡的 `amplify_outputs.json` 再 push，App 就回到純本機模式。
手機上的資料完全不受影響，之後放回檔案即可重新同步。

## 已知限制

- 兩個人同時編輯同一個人，以最後儲存的版本為準（整筆覆蓋，不是欄位合併）。
- 「目前場合」與備份時間是每支手機各自的設定，不同步。
- 同步靠 App 開著時觸發（開啟、切回前景、儲存後、每 5 分鐘），iOS 不允許主畫面 App 在背景持續同步。
- 尚未做「刪除雲端所有資料」；設定頁的清除只影響那支手機。上架 App Store 前需要補上。
