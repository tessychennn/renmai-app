import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Group, Person, Settings } from '../types';

export interface PhotoRecord {
  id: string;
  blob: Blob; // 僅 IndexedDB 實作使用，不可外洩到 UI 層
  thumbBlob: Blob; // 長邊 320px 縮圖
  width: number;
  height: number;
  createdAt: string;
}

interface RenmaiDB extends DBSchema {
  persons: {
    key: string;
    value: Person;
    indexes: { 'by-occasion': string; 'by-updatedAt': string };
  };
  groups: { key: string; value: Group };
  photos: { key: string; value: PhotoRecord };
  settings: { key: string; value: Settings };
}

let dbPromise: Promise<IDBPDatabase<RenmaiDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<RenmaiDB>> {
  dbPromise ??= openDB<RenmaiDB>('renmai', 1, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const persons = db.createObjectStore('persons', { keyPath: 'id' });
        persons.createIndex('by-occasion', 'occasion');
        persons.createIndex('by-updatedAt', 'updatedAt');
        db.createObjectStore('groups', { keyPath: 'id' });
        db.createObjectStore('photos', { keyPath: 'id' });
        db.createObjectStore('settings');
      }
    },
  });
  return dbPromise;
}

/** 測試用：關閉並重置連線，讓下一次 getDB 重新開啟 */
export async function closeDB(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
}
