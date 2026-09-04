import { getDB } from './db';
import type { Settings, SettingsRepo } from '../types';

const KEY = 'app';

export class IndexedDBSettingsRepo implements SettingsRepo {
  async get(): Promise<Settings> {
    const db = await getDB();
    return (await db.get('settings', KEY)) ?? {};
  }

  async save(settings: Settings): Promise<void> {
    const db = await getDB();
    await db.put('settings', settings, KEY);
  }
}
