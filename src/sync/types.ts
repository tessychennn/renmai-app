import type { Group, Person, Task, TaskOption } from '../data/types';
import type { DirtyEntry } from '../data/indexeddb/db';

export type { DirtyEntry };

/** 同步引擎處理「單筆資料」的種類（照片另外處理） */
export type EntityKind = 'person' | 'group' | 'task' | 'option';

/** 雲端端點。同步引擎只認這個介面，不知道背後是 Amplify 還是別的。 */
export interface RemoteStore {
  /** 全部人物，含墓碑（deletedAt） */
  listPersons(): Promise<Person[]>;
  listGroups(): Promise<Group[]>;
  listTasks(): Promise<Task[]>;
  listOptions(): Promise<TaskOption[]>;
  putPerson(person: Person): Promise<void>;
  putGroup(group: Group): Promise<void>;
  putTask(task: Task): Promise<void>;
  putOption(option: TaskOption): Promise<void>;
  uploadPhoto(id: string, full: Blob, thumb: Blob): Promise<void>;
  /** 雲端沒有這張照片時回傳 null；網路錯誤則拋出 */
  downloadPhoto(id: string, variant: 'full' | 'thumb'): Promise<Blob | null>;
  deletePhotos(ids: string[]): Promise<void>;
}

/** 本機端點。同步引擎透過它讀寫本機資料庫。 */
export interface SyncLocal {
  isInitialized(): Promise<boolean>;
  /** 第一次啟用雲端：把現有的全部資料標記為待上傳 */
  initialize(): Promise<void>;

  /** 全部資料，含墓碑 */
  listPersons(): Promise<Person[]>;
  listGroups(): Promise<Group[]>;
  listTasks(): Promise<Task[]>;
  listOptions(): Promise<TaskOption[]>;
  getPerson(id: string): Promise<Person | undefined>;
  getGroup(id: string): Promise<Group | undefined>;
  getTask(id: string): Promise<Task | undefined>;
  getOption(id: string): Promise<TaskOption | undefined>;

  /**
   * 寫入雲端版本（不標記為待上傳，並清掉該筆的待上傳標記）。
   * 寫入前會再確認本機版本沒有更新，回傳是否真的寫入。
   */
  applyPerson(person: Person): Promise<boolean>;
  applyGroup(group: Group): Promise<boolean>;
  applyTask(task: Task): Promise<boolean>;
  applyOption(option: TaskOption): Promise<boolean>;

  markDirty(kind: EntityKind, id: string): Promise<void>;
  listDirty(): Promise<DirtyEntry[]>;
  /** 清除待上傳標記；帶 ifUpdatedAt 時，本機版本在上傳期間又被改過就保留標記 */
  clearDirty(key: string, ifUpdatedAt?: string): Promise<void>;

  listPhotosToUpload(): Promise<string[]>;
  getPhotoForUpload(id: string): Promise<{ full: Blob; thumb: Blob } | null>;
  markPhotoUploaded(id: string): Promise<void>;
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
