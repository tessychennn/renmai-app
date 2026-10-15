// 單一出口：UI 只從這裡拿 repo。未來換 Capacitor / Supabase 實作時只改這個檔案。
import { IndexedDBPersonRepo } from './indexeddb/personRepo';
import { IndexedDBClientRepo } from './indexeddb/clientRepo';
import { IndexedDBPhotoRepo } from './indexeddb/photoRepo';
import { IndexedDBProgressOptionRepo } from './indexeddb/progressOptionRepo';
import { IndexedDBProgressRepo } from './indexeddb/progressRepo';
import { IndexedDBGroupRepo } from './indexeddb/groupRepo';
import { IndexedDBSettingsRepo } from './indexeddb/settingsRepo';
import { IndexedDBSyncLocal } from './indexeddb/syncLocal';
import { IndexedDBTaskOptionRepo } from './indexeddb/taskOptionRepo';
import { IndexedDBTaskRepo } from './indexeddb/taskRepo';
import { clientIdOf } from './clientId';
import { prospectTaskId } from './prospectId';
import type {
  ClientRepo,
  GroupRepo,
  PersonRepo,
  PhotoRepo,
  ProgressOptionRepo,
  ProgressRepo,
  SettingsRepo,
  TaskOptionRepo,
  TaskRepo,
} from './types';
import type { SyncLocal } from '../sync/types';

export const personRepo: PersonRepo = new IndexedDBPersonRepo();
export const photoRepo: PhotoRepo = new IndexedDBPhotoRepo();
export const groupRepo: GroupRepo = new IndexedDBGroupRepo();
export const settingsRepo: SettingsRepo = new IndexedDBSettingsRepo();
export const taskRepo: TaskRepo = new IndexedDBTaskRepo();
export const taskOptionRepo: TaskOptionRepo = new IndexedDBTaskOptionRepo();
export const progressRepo: ProgressRepo = new IndexedDBProgressRepo();
export const progressOptionRepo: ProgressOptionRepo = new IndexedDBProgressOptionRepo();
export const clientRepo: ClientRepo = new IndexedDBClientRepo();

/** 同步引擎讀寫本機資料庫的入口（雲端同步啟用後才會用到） */
export const syncLocal: SyncLocal = new IndexedDBSyncLocal();
export { setPhotoTransport } from './indexeddb/photoRepo';

export { destroyDB as clearAllData } from './indexeddb/db';
export { ensureDefaultGroups } from './indexeddb/seedGroups';
export { ensureDefaultTaskOptions } from './indexeddb/seedTaskOptions';
export { ensureDefaultProgressOptions } from './indexeddb/seedProgressOptions';

/** 刪除人物並一併刪除其所有照片（規格 5.3：避免孤兒資料）與對應的客戶紀錄 */
export async function deletePersonWithPhotos(id: string): Promise<void> {
  const person = await personRepo.get(id);
  if (!person) return;
  await Promise.all(person.photoIds.map((photoId) => photoRepo.remove(photoId)));
  await personRepo.remove(id);
  await clientRepo.remove(clientIdOf(id));
  await taskRepo.remove(prospectTaskId(id)); // 舊版的業務開發待辦（已搬成客戶，保險起見一併清掉）
}
