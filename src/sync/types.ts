import type {
  Client,
  Group,
  Person,
  ProgressItem,
  ProgressOption,
  Task,
  TaskOption,
} from '../data/types';
import type { DirtyEntry } from '../data/indexeddb/db';

export type { DirtyEntry };

/**
 * 同步範圍：這個帳號有權限的資料。沒有權限的資料伺服器會拒絕，所以引擎根本不去讀、不去寫。
 * - people：人脈記錄（人物、分組、客戶、照片）
 * - todo：待辦（任務與待辦選項）
 * - progress：產品進度（項目與產品進度選項）
 */
export interface SyncScope {
  people: boolean;
  todo: boolean;
  progress: boolean;
}

export const FULL_SYNC_SCOPE: SyncScope = { people: true, todo: true, progress: true };

/** 同步引擎處理「單筆資料」的種類（照片另外處理） */
export type EntityKind = 'person' | 'group' | 'task' | 'option' | 'item' | 'popt' | 'client';

/** 每一種待上傳的資料屬於哪個範圍 */
export const SCOPE_OF_KIND: Record<DirtyEntry['kind'], keyof SyncScope> = {
  person: 'people',
  group: 'people',
  client: 'people',
  photo: 'people',
  task: 'todo',
  option: 'todo',
  item: 'progress',
  popt: 'progress',
};

/** 雲端端點。同步引擎只認這個介面，不知道背後是 Amplify 還是別的。 */
export interface RemoteStore {
  /** 全部人物，含墓碑（deletedAt） */
  listPersons(): Promise<Person[]>;
  listGroups(): Promise<Group[]>;
  listClients(): Promise<Client[]>;
  listTasks(): Promise<Task[]>;
  listOptions(): Promise<TaskOption[]>;
  listProgress(): Promise<ProgressItem[]>;
  listProgressOptions(): Promise<ProgressOption[]>;
  putPerson(person: Person): Promise<void>;
  putGroup(group: Group): Promise<void>;
  putClient(client: Client): Promise<void>;
  putTask(task: Task): Promise<void>;
  putOption(option: TaskOption): Promise<void>;
  putProgress(item: ProgressItem): Promise<void>;
  putProgressOption(option: ProgressOption): Promise<void>;
  uploadPhoto(id: string, full: Blob, thumb: Blob): Promise<void>;
  /** 雲端沒有這張照片時回傳 null；網路錯誤則拋出 */
  downloadPhoto(id: string, variant: 'full' | 'thumb'): Promise<Blob | null>;
  deletePhotos(ids: string[]): Promise<void>;
}

/** 本機端點。同步引擎透過它讀寫本機資料庫。 */
export interface SyncLocal {
  isInitialized(scope?: SyncScope): Promise<boolean>;
  /** 第一次啟用雲端：把這個範圍內現有的資料標記為待上傳 */
  initialize(scope?: SyncScope): Promise<void>;

  /** 全部資料，含墓碑 */
  listPersons(): Promise<Person[]>;
  listGroups(): Promise<Group[]>;
  listClients(): Promise<Client[]>;
  listTasks(): Promise<Task[]>;
  listOptions(): Promise<TaskOption[]>;
  listProgress(): Promise<ProgressItem[]>;
  listProgressOptions(): Promise<ProgressOption[]>;
  getPerson(id: string): Promise<Person | undefined>;
  getGroup(id: string): Promise<Group | undefined>;
  getClient(id: string): Promise<Client | undefined>;
  getTask(id: string): Promise<Task | undefined>;
  getOption(id: string): Promise<TaskOption | undefined>;
  getProgress(id: string): Promise<ProgressItem | undefined>;
  getProgressOption(id: string): Promise<ProgressOption | undefined>;

  /**
   * 寫入雲端版本（不標記為待上傳，並清掉該筆的待上傳標記）。
   * 寫入前會再確認本機版本沒有更新，回傳是否真的寫入。
   */
  applyPerson(person: Person): Promise<boolean>;
  applyGroup(group: Group): Promise<boolean>;
  applyClient(client: Client): Promise<boolean>;
  applyTask(task: Task): Promise<boolean>;
  applyOption(option: TaskOption): Promise<boolean>;
  applyProgress(item: ProgressItem): Promise<boolean>;
  applyProgressOption(option: ProgressOption): Promise<boolean>;

  markDirty(kind: EntityKind, id: string): Promise<void>;
  listDirty(): Promise<DirtyEntry[]>;
  /** 清除待上傳標記；帶 ifUpdatedAt 時，本機版本在上傳期間又被改過就保留標記 */
  clearDirty(key: string, ifUpdatedAt?: string): Promise<void>;

  listPhotosToUpload(): Promise<string[]>;
  getPhotoForUpload(id: string): Promise<{ full: Blob; thumb: Blob } | null>;
  markPhotoUploaded(id: string): Promise<void>;
  requeueAllPhotos(): Promise<number>;
  /** 回傳其中本機還沒有縮圖的 id */
  missingThumbs(ids: string[]): Promise<string[]>;
  savePhotoBlob(id: string, variant: 'full' | 'thumb', blob: Blob): Promise<void>;
  /** 移除本機照片（不產生待上傳標記；用於雲端已刪除的照片） */
  removePhotos(ids: string[]): Promise<void>;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  photosUploaded: number;
  photosDownloaded: number;
  errors: string[];
}
