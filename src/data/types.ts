export interface Person {
  id: string; // crypto.randomUUID()
  displayName: string; // 必填
  lineName?: string; // 選填；UI 標籤寫「聯絡帳號」
  avatarPhotoId?: string; // 必須指向 photoIds 中的其中一張
  photoIds: string[];
  groupIds: string[];
  occasion?: string;
  metDate?: string; // ISO date，預設今天
  note?: string;
  /** 合作機會：有狀態就代表被標記，會出現在「合作機會」頁；沒有就不在列表裡 */
  collabStatus?: CollabStatus;
  collabOwner?: CollabOwner;
  /** 合作專用備註，和上面一般的 note 分開 */
  collabNote?: string;
  createdAt: string;
  updatedAt: string;
  /** 軟刪除標記：同步時要讓另一支手機知道這筆被刪了，所以不能直接消失 */
  deletedAt?: string;
}

export type CollabStatus = 'contact' | 'contacting' | 'scheduled' | 'done';
export type CollabOwner = 'Tessy' | 'Serina';

export interface Group {
  id: string;
  name: string;
  color: string; // hex
  order: number;
  updatedAt: string;
  deletedAt?: string;
}

/** 待辦的選項清單：分類、成員、優先級、狀態。任務用編號引用，改名不需要同步舊任務。 */
export type TaskOptionKind = 'category' | 'member' | 'priority' | 'status';

export interface TaskOption {
  id: string;
  kind: TaskOptionKind;
  name: string;
  order: number;
  /** 成員專用：登入信箱，用來判斷「是誰操作」 */
  email?: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Task {
  id: string;
  name: string;
  categoryId: string;
  ownerId?: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  priorityId?: string;
  statusId?: string;
  note?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  done: boolean;
  /** YYYY-MM-DD */
  doneAt?: string;
  doneBy?: string;
  deletedAt?: string;
}

/**
 * 產品進度的選項（大項目、營運優先級、技術等級、狀態），管理員在「產品進度設定」新增、改名、排序、上色。
 * 項目用選項的編號引用，改名不用同步舊項目。預設選項的編號沿用最初的代碼（P0、S、proposed…），
 * 所以改成可編輯之前建立的項目不用轉換。
 */
export type ProgressOptionKind = 'project' | 'priority' | 'tech' | 'status';

export interface ProgressOption {
  id: string;
  kind: ProgressOptionKind;
  name: string;
  order: number;
  /** 標籤顏色：gray、green、yellow、red、purple、blue */
  color: string;
  /** 下拉選單裡的說明（選填） */
  hint?: string;
  /** 狀態專用：代表「完成」。打勾完成與完成頁籤都看這個。 */
  isDone?: boolean;
  updatedAt: string;
  deletedAt?: string;
}

/** 產品進度的一個小項目；各個欄位都是上面選項的編號 */
export interface ProgressItem {
  id: string;
  name: string;
  /** 大項目 */
  projectId: string;
  /** 營運優先級（營運端決定，只表示對營運多重要） */
  opsPriority?: string;
  /** 技術等級（技術端自己估的工作量） */
  techLevel?: string;
  /** 狀態 */
  status: string;
  /** 目標日期 YYYY-MM-DD */
  dueDate?: string;
  /** 營運端的備註：為什麼需要、希望達到什麼 */
  opsNote?: string;
  /** 技術端的備註：做法、風險、卡在哪 */
  techNote?: string;
  /** 完成日 YYYY-MM-DD */
  doneAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ProgressOptionRepo {
  /** 未刪除的選項，依 order 排序；不帶 kind 就是全部 */
  list(kind?: ProgressOptionKind): Promise<ProgressOption[]>;
  save(option: ProgressOption): Promise<void>;
  saveMany(options: ProgressOption[]): Promise<void>;
  remove(id: string): Promise<void>;
}

/**
 * 客戶：聯絡中的名單。兩種來源：
 * - 從人脈記錄標記的人：personId 指向人物，編號由人物編號固定推出（client-人物編號），兩支手機各自建立也是同一筆；
 *   名字不另存，直接讀人物資料，改名不會對不上。
 * - 在客戶頁直接新增的：沒有 personId，自己存名字（name），編號是隨機的。
 */
export interface Client {
  id: string;
  /** 從人脈記錄標記的才有 */
  personId?: string;
  /** 在客戶頁直接新增的才有；有連結人物的客戶名字讀人物資料 */
  name?: string;
  /** 等級（重要／潛在）：src/text/clients.ts 裡的等級編號；沒設定就排在最後 */
  level?: string;
  /** 狀態：src/text/clients.ts 裡的狀態編號 */
  statusId?: string;
  /** 負責人：待辦選項裡 kind = 'member' 的那一種 */
  ownerId?: string;
  /** 下次聯絡 YYYY-MM-DD */
  dueDate?: string;
  note?: string;
  done: boolean;
  /** YYYY-MM-DD */
  doneAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ClientRepo {
  /** 未刪除的客戶（含已完成） */
  list(): Promise<Client[]>;
  get(id: string): Promise<Client | null>;
  save(client: Client): Promise<void>;
  saveMany(clients: Client[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ProgressRepo {
  /** 未刪除的小項目（含已完成） */
  list(): Promise<ProgressItem[]>;
  get(id: string): Promise<ProgressItem | null>;
  save(item: ProgressItem): Promise<void>;
  saveMany(items: ProgressItem[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface TaskRepo {
  /** 未刪除的任務（含已完成） */
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | null>;
  save(task: Task): Promise<void>;
  saveMany(tasks: Task[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface TaskOptionRepo {
  /** 未刪除的選項，依 order 排序；不帶 kind 就是全部 */
  list(kind?: TaskOptionKind): Promise<TaskOption[]>;
  save(option: TaskOption): Promise<void>;
  saveMany(options: TaskOption[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface Settings {
  currentOccasion?: string;
  lastExportAt?: string;
}

export type PersonSort =
  | 'createdAt-desc' // 最近加入（預設）
  | 'createdAt-asc' // 最早加入
  | 'metDate-desc' // 最近認識
  | 'metDate-asc' // 最早認識
  | 'name'; // 名稱

export interface PersonFilter {
  search?: string;
  groupIds?: string[];
  sort?: PersonSort;
}

export interface PersonRepo {
  list(filter?: PersonFilter): Promise<Person[]>;
  get(id: string): Promise<Person | null>;
  save(person: Person): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface PhotoRepo {
  /** 存入一張圖（內部同時產生完整版與縮圖），回傳 photoId */
  put(blob: Blob): Promise<string>;
  /** 匯入備份用：以指定 id 存入已壓縮的圖（不再壓縮，縮圖重新產生） */
  restore(id: string, blob: Blob): Promise<void>;
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

export interface SettingsRepo {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}
