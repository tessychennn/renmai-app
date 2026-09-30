import { notifyLocalChange } from '../changeSignal';
import { dirtyKey, getDB, savePhotoVariant } from './db';
import type { PhotoRepo } from '../types';
import { compressImage, makeThumbnail, readImageSize } from '../../lib/image';

/** 本機沒有這張照片時，向雲端下載的管道。雲端同步啟用後由外部注入。 */
export interface PhotoTransport {
  download(id: string, variant: 'full' | 'thumb'): Promise<Blob | null>;
}

let transport: PhotoTransport | null = null;

export function setPhotoTransport(next: PhotoTransport | null): void {
  transport = next;
}

export class IndexedDBPhotoRepo implements PhotoRepo {
  async put(blob: Blob): Promise<string> {
    const full = await compressImage(blob);
    const thumbBlob = await makeThumbnail(blob);
    const record = {
      id: crypto.randomUUID(),
      blob: full.blob,
      thumbBlob,
      width: full.width,
      height: full.height,
      createdAt: new Date().toISOString(),
    };
    const db = await getDB();
    await db.put('photos', record);
    return record.id;
  }

  async restore(id: string, blob: Blob): Promise<void> {
    const { width, height } = await readImageSize(blob);
    const thumbBlob = await makeThumbnail(blob);
    const db = await getDB();
    await db.put('photos', {
      id,
      blob,
      thumbBlob,
      width,
      height,
      createdAt: new Date().toISOString(),
    });
  }

  async getURL(id: string, variant: 'full' | 'thumb' = 'full'): Promise<string> {
    const db = await getDB();
    const record = await db.get('photos', id);
    let blob = variant === 'thumb' ? record?.thumbBlob : record?.blob;
    if (!blob) {
      const downloaded = await transport?.download(id, variant);
      if (!downloaded) throw new Error(`找不到照片：${id}`);
      await savePhotoVariant(id, variant, downloaded);
      blob = downloaded;
    }
    return URL.createObjectURL(blob);
  }

  releaseURL(url: string): void {
    URL.revokeObjectURL(url);
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['photos', 'dirty'], 'readwrite');
    await Promise.all([
      tx.objectStore('photos').delete(id),
      // 通知雲端也刪掉這張，避免被移除的照片永遠留在雲端
      tx.objectStore('dirty').put({ key: dirtyKey('photo', id), kind: 'photo', id }),
      tx.done,
    ]);
    notifyLocalChange();
  }
}
