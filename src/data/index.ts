// 單一出口：UI 只從這裡拿 repo。未來換 Capacitor / Supabase 實作時只改這個檔案。
import { IndexedDBPersonRepo } from './indexeddb/personRepo';
import { IndexedDBPhotoRepo } from './indexeddb/photoRepo';
import { IndexedDBGroupRepo } from './indexeddb/groupRepo';
import { IndexedDBSettingsRepo } from './indexeddb/settingsRepo';
import type { GroupRepo, PersonRepo, PhotoRepo, SettingsRepo } from './types';

export const personRepo: PersonRepo = new IndexedDBPersonRepo();
export const photoRepo: PhotoRepo = new IndexedDBPhotoRepo();
export const groupRepo: GroupRepo = new IndexedDBGroupRepo();
export const settingsRepo: SettingsRepo = new IndexedDBSettingsRepo();

export { destroyDB as clearAllData } from './indexeddb/db';

/** 刪除人物並一併刪除其所有照片（規格 5.3：避免孤兒資料） */
export async function deletePersonWithPhotos(id: string): Promise<void> {
  const person = await personRepo.get(id);
  if (!person) return;
  await Promise.all(person.photoIds.map((photoId) => photoRepo.remove(photoId)));
  await personRepo.remove(id);
}
