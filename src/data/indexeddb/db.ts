import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Group, Person, Settings, Task, TaskOption } from '../types';

export interface PhotoRecord {
  id: string;
  blob?: Blob; // 僅 IndexedDB 實作使用，不可外洩到 UI 層；從雲端同步來的照片一開始只有縮圖，完整版點開才下載
  thumbBlob?: Blob; // 長邊 320px 縮圖
  width: number;
  height: number;
  createdAt: string;
  /** 已確認存在於雲端。沒有這個標記的本機照片會在下次同步上傳 */
  uploaded?: boolean;
}

/** 待上傳的變動：人物、分組、待辦、待辦選項，或被移除的照片（要通知雲端刪除） */
export interface DirtyEntry {
  key: string;
  kind: 'person' | 'group' | 'photo' | 'task' | 'option';
  id: string;
}

export const dirtyKey = (kind: DirtyEntry['kind'], id: string) => `${kind}:${id}`;

interface RenmaiDB extends DBSchema {
  persons: {
    key: string;
    value: Person;
    indexes: { 'by-occasion': string; 'by-updatedAt': string };
  };
  groups: { key: string; value: Group };
  photos: { key: string; value: PhotoRecord };
  settings: { key: string; value: Settings };
  syncMeta: { key: string; value: unknown };
  dirty: { key: string; value: DirtyEntry };
  tasks: { key: string; value: Task };
  taskOptions: { key: string; value: TaskOption };
}

export const DB_NAME = 'renmai';
export const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<RenmaiDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<RenmaiDB>> {
  dbPromise ??= openDB<RenmaiDB>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const persons = db.createObjectStore('persons', { keyPath: 'id' });
        persons.createIndex('by-occasion', 'occasion');
        persons.createIndex('by-updatedAt', 'updatedAt');
        db.createObjectStore('groups', { keyPath: 'id' });
        db.createObjectStore('photos', { keyPath: 'id' });
        db.createObjectStore('settings');
      }
      if (oldVersion < 2) {
        db.createObjectStore('syncMeta');
        db.createObjectStore('dirty', { keyPath: 'key' });
        // v1 的分組沒有 updatedAt，同步比對新舊需要它
        const now = new Date().toISOString();
        let cursor = await tx.objectStore('groups').openCursor();
        while (cursor) {
          if (!cursor.value.updatedAt) {
            await cursor.update({ ...cursor.value, updatedAt: now });
          }
          cursor = await cursor.continue();
        }
      }
      if (oldVersion < 3) {
        db.createObjectStore('tasks', { keyPath: 'id' });
        db.createObjectStore('taskOptions', { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

/** 把下載回來的照片（完整版或縮圖）併入本機紀錄 */
export async function savePhotoVariant(
  id: string,
  variant: 'full' | 'thumb',
  blob: Blob
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('photos', 'readwrite');
  const current = await tx.store.get(id);
  await tx.store.put({
    width: 0,
    height: 0,
    createdAt: new Date().toISOString(),
    ...current,
    id,
    uploaded: true,
    ...(variant === 'thumb' ? { thumbBlob: blob } : { blob }),
  });
  await tx.done;
}

/** 測試用：關閉並重置連線，讓下一次 getDB 重新開啟 */
export async function closeDB(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
}

/** 刪除整個資料庫（「刪除所有資料」與「取代匯入」用） */
export async function destroyDB(): Promise<void> {
  await closeDB();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
