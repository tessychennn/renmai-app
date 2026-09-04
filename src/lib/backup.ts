import {
  clearAllData,
  groupRepo,
  personRepo,
  photoRepo,
  settingsRepo,
} from '../data';
import type { Group, Person, Settings } from '../data/types';

export interface BackupPhoto {
  id: string;
  data: string; // base64 JPEG（已壓縮的完整版；縮圖匯入時重新產生）
}

export interface BackupFile {
  version: 1;
  exportedAt: string;
  persons: Person[];
  groups: Group[];
  settings: Settings;
  photos: BackupPhoto[];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

/**
 * 匯出成單一 JSON Blob。
 * 不對整包資料一次 JSON.stringify —— 照片逐張序列化 push 進 parts，
 * 最後用 Blob 組裝，避免大字串在 iOS Safari 造成記憶體不足。
 */
export async function exportBackup(): Promise<Blob> {
  const persons = await personRepo.list();
  const groups = await groupRepo.list();
  const settings = await settingsRepo.get();

  const parts: string[] = [];
  parts.push('{"version":1,"exportedAt":' + JSON.stringify(new Date().toISOString()));
  parts.push(',"persons":' + JSON.stringify(persons));
  parts.push(',"groups":' + JSON.stringify(groups));
  parts.push(',"settings":' + JSON.stringify(settings));
  parts.push(',"photos":[');

  const photoIds = [...new Set(persons.flatMap((p) => p.photoIds))];
  let first = true;
  for (const id of photoIds) {
    let url: string | null = null;
    try {
      url = await photoRepo.getURL(id, 'full');
      const blob = await (await fetch(url)).blob();
      const data = await blobToBase64(blob);
      parts.push((first ? '' : ',') + JSON.stringify({ id, data }));
      first = false;
    } catch {
      // 孤兒引用：略過，不讓一張壞照片毀掉整份備份
    } finally {
      if (url) photoRepo.releaseURL(url);
    }
  }
  parts.push(']}');
  return new Blob(parts, { type: 'application/json' });
}

/** 觸發下載並更新上次匯出時間 */
export async function exportAndDownload(): Promise<void> {
  const blob = await exportBackup();
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `人脈備份-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  const settings = await settingsRepo.get();
  await settingsRepo.save({ ...settings, lastExportAt: new Date().toISOString() });
}

export async function importBackup(file: File, mode: 'merge' | 'replace'): Promise<void> {
  let data: BackupFile;
  try {
    data = JSON.parse(await file.text()) as BackupFile;
  } catch {
    throw new Error('這不是有效的備份檔');
  }
  if (data.version !== 1 || !Array.isArray(data.persons)) {
    throw new Error('不支援的備份格式');
  }

  if (mode === 'replace') {
    await clearAllData();
  }

  for (const photo of data.photos ?? []) {
    await photoRepo.restore(photo.id, base64ToBlob(photo.data));
  }
  for (const group of data.groups ?? []) {
    await groupRepo.save(group);
  }
  for (const person of data.persons) {
    const existing = await personRepo.get(person.id);
    // 以 id 判斷重複，updatedAt 較新者為準
    if (!existing || existing.updatedAt <= person.updatedAt) {
      await personRepo.save(person);
    }
  }
  if (mode === 'replace') {
    await settingsRepo.save(data.settings ?? {});
  }
}

/** 距上次匯出是否超過 days 天（從未匯出視為超過） */
export function isBackupStale(lastExportAt: string | undefined, days = 14): boolean {
  if (!lastExportAt) return true;
  return Date.now() - new Date(lastExportAt).getTime() > days * 24 * 60 * 60 * 1000;
}
