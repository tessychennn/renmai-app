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
