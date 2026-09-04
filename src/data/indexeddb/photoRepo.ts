import { getDB } from './db';
import type { PhotoRepo } from '../types';
import { compressImage, makeThumbnail, readImageSize } from '../../lib/image';

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
    if (!record) throw new Error(`找不到照片：${id}`);
    return URL.createObjectURL(variant === 'thumb' ? record.thumbBlob : record.blob);
  }

  releaseURL(url: string): void {
    URL.revokeObjectURL(url);
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('photos', id);
  }
}
