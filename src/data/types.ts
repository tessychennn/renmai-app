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
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  color: string; // hex
  order: number;
}

export interface Settings {
  currentOccasion?: string;
  lastExportAt?: string;
}

export interface PersonFilter {
  search?: string;
  groupIds?: string[];
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
