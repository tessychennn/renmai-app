import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CropModal, { type CropResult } from '../components/CropModal';
import GlassHeader, { HEADER_PAD } from '../components/GlassHeader';
import { groupRepo, personRepo, photoRepo, settingsRepo } from '../data';
import { preloadScanner } from '../lib/documentScan';
import type { Group, Person } from '../data/types';

interface StagedPhoto {
  key: string;
  photoId?: string; // 已存在於 repo 的照片
  file?: Blob; // 尚未存檔的新照片（可能是裁切後的版本）
  originalFile?: Blob; // 裁切前的原圖，可還原
  previewURL: string;
}

interface PendingCrop {
  id: string;
  file: File;
}

const GROUP_COLORS = [
  '#5B8DEF',
  '#E8843C',
  '#3FA66A',
  '#B4372E',
  '#8A63C7',
  '#D8A800',
  '#2C7A8C',
  '#C25C8A',
];

const fieldClass =
  'w-full rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

export default function PersonFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [source, setSource] = useState<Person | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [metDate, setMetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [lineName, setLineName] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [cropQueue, setCropQueue] = useState<PendingCrop[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const photosRef = useRef<StagedPhoto[]>([]);
  photosRef.current = photos;

  useEffect(() => {
    preloadScanner(); // 先在背景載 OpenCV，拍第一張時就不用等
    void groupRepo.list().then(setGroups);
    if (id) {
      void personRepo.get(id).then(async (person) => {
        if (!person) return;
        setSource(person);
        setDisplayName(person.displayName);
        setOccasion(person.occasion ?? '');
        setMetDate(person.metDate ?? '');
        setNote(person.note ?? '');
        setLineName(person.lineName ?? '');
        if (person.lineName) setShowMore(true);
        setSelectedGroupIds(person.groupIds);
        const staged: StagedPhoto[] = [];
        for (const photoId of person.photoIds) {
          try {
            staged.push({ key: photoId, photoId, previewURL: await photoRepo.getURL(photoId, 'thumb') });
          } catch {
            // 孤兒引用：略過
          }
        }
        setPhotos(staged);
        setAvatarKey(person.avatarPhotoId ?? staged[0]?.key ?? null);
      });
    } else {
      void settingsRepo.get().then((s) => {
        if (s.currentOccasion) setOccasion(s.currentOccasion);
      });
    }
    return () => {
      for (const p of photosRef.current) photoRepo.releaseURL(p.previewURL);
    };
  }, [id]);

  // 新照片一律先進裁切確認頁（多張會排隊一張一張確認）
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const added: PendingCrop[] = Array.from(list).map((file) => ({
      id: crypto.randomUUID(),
      file,
    }));
    setCropQueue((prev) => [...prev, ...added]);
  };

  const handleCropDone = (result: CropResult | null) => {
    if (result) {
      const staged: StagedPhoto = {
        key: crypto.randomUUID(),
        file: result.blob,
        originalFile: result.original,
        previewURL: URL.createObjectURL(result.blob),
      };
      setPhotos((prev) => {
        setAvatarKey((k) => k ?? staged.key);
        return [...prev, staged];
      });
    }
    setCropQueue((prev) => prev.slice(1));
  };

  const revertCrop = (key: string) => {
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.key !== key || !p.originalFile) return p;
        photoRepo.releaseURL(p.previewURL);
        return {
          ...p,
          file: p.originalFile,
          originalFile: undefined,
          previewURL: URL.createObjectURL(p.originalFile),
        };
      })
    );
  };

  const movePhoto = (key: string, dir: -1 | 1) => {
    setPhotos((prev) => {
      const i = prev.findIndex((p) => p.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removePhoto = (key: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) {
        photoRepo.releaseURL(target.previewURL);
        if (target.photoId) setRemovedPhotoIds((r) => [...r, target.photoId!]);
      }
      const next = prev.filter((p) => p.key !== key);
      setAvatarKey((k) => (k === key ? (next[0]?.key ?? null) : k));
      return next;
    });
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    const group: Group = {
      id: crypto.randomUUID(),
      name,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
      order: groups.length,
    };
    await groupRepo.save(group);
    setGroups((prev) => [...prev, group]);
    setSelectedGroupIds((prev) => [...prev, group.id]);
    setNewGroupName('');
    setAddingGroup(false);
  };

  const submit = async () => {
    const name = displayName.trim();
    if (!name) {
      setError('暱稱是必填的。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const photoIds: string[] = [];
      let avatarPhotoId: string | undefined;
      for (const staged of photos) {
        let photoId = staged.photoId;
        if (!photoId && staged.file) photoId = await photoRepo.put(staged.file);
        if (photoId) {
          photoIds.push(photoId);
          if (staged.key === avatarKey) avatarPhotoId = photoId;
        }
      }
      if (!avatarPhotoId && photoIds.length > 0) avatarPhotoId = photoIds[0];
      for (const removedId of removedPhotoIds) await photoRepo.remove(removedId);

      const now = new Date().toISOString();
      const person: Person = {
        id: source?.id ?? crypto.randomUUID(),
        displayName: name,
        lineName: lineName.trim() || undefined,
        avatarPhotoId,
        photoIds,
        groupIds: selectedGroupIds,
        occasion: occasion.trim() || undefined,
        metDate: metDate || undefined,
        note: note.trim() || undefined,
        createdAt: source?.createdAt ?? now,
        updatedAt: now,
      };
      await personRepo.save(person);
      // 這次用的場合自動成為「目前場合」，下一個人不用重打
      if (person.occasion) {
        const settings = await settingsRepo.get();
        if (settings.currentOccasion !== person.occasion) {
          await settingsRepo.save({ ...settings, currentOccasion: person.occasion });
        }
      }
      if (editing) {
        navigate(`/person/${person.id}`, { replace: true });
      } else {
        navigate('/', { state: { toast: `已記下 ${person.displayName}` } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次。');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <GlassHeader
        title={editing ? '編輯' : '新增人物'}
        back
        right={
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="rounded-full bg-ink px-4 py-1.5 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {saving ? '儲存中⋯' : '儲存'}
          </button>
        }
      />

      <main
        className="flex flex-col gap-5 px-5"
        style={{
          paddingTop: HEADER_PAD,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)',
        }}
      >
        {/* 照片優先：剛拿到明信片的當下先拍 */}
        <section>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <div key={photo.key} className="relative aspect-square">
                <button
                  type="button"
                  onClick={() => setAvatarKey(photo.key)}
                  aria-label={photo.key === avatarKey ? '目前的大頭貼' : '設為大頭貼'}
                  className="h-full w-full overflow-hidden rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <img src={photo.previewURL} alt="" className="h-full w-full object-cover" />
                </button>
                {photo.key === avatarKey && (
                  <span className="glass absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-xs font-medium">
                    大頭貼
                  </span>
                )}
                {photo.originalFile && (
                  <button
                    type="button"
                    onClick={() => revertCrop(photo.key)}
                    className="glass absolute left-1 top-1 rounded-full px-2 py-0.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    已裁切・還原
                  </button>
                )}
                {photos.length > 1 && (
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => movePhoto(photo.key, -1)}
                        aria-label="往前移"
                        className="glass flex h-6 w-6 items-center justify-center rounded-full text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M6.5 1.5 3 5l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                    {index < photos.length - 1 && (
                      <button
                        type="button"
                        onClick={() => movePhoto(photo.key, 1)}
                        aria-label="往後移"
                        className="glass flex h-6 w-6 items-center justify-center rounded-full text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M3.5 1.5 7 5 3.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(photo.key)}
                  aria-label="移除照片"
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="m3 3 6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {/* 用原生 label 觸發 file input：iOS 上比程式呼叫 click() 可靠 */}
          <div className={`flex gap-2 ${photos.length > 0 ? 'mt-2' : ''}`}>
            <label className="flex-1 cursor-pointer rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 text-center font-medium focus-within:outline focus-within:outline-2 focus-within:outline-ink">
              拍照
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <label className="flex-1 cursor-pointer rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 text-center font-medium focus-within:outline focus-within:outline-2 focus-within:outline-ink">
              從相簿選
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </section>

        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">暱稱（必填）</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="照抄對方的顯示名稱"
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">場合</span>
          <input
            type="text"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="例：2026 設計週"
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">認識日期</span>
          <input
            type="date"
            value={metDate}
            onChange={(e) => setMetDate(e.target.value)}
            className={fieldClass}
          />
        </label>

        <section>
          <span className="mb-1.5 block text-sm text-ink-2">分組</span>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => {
              const active = selectedGroupIds.includes(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSelectedGroupIds((prev) =>
                      active ? prev.filter((g) => g !== group.id) : [...prev, group.id]
                    )
                  }
                  className={`flex items-center gap-1.5 rounded-full border-[0.5px] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
                    active ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-ink'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
                  {group.name}
                </button>
              );
            })}
            {addingGroup ? (
              <span className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createGroup();
                  }}
                  placeholder="分組名稱"
                  autoFocus
                  className="w-32 rounded-full border-[0.5px] border-hairline bg-white px-3 py-1.5 text-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                />
                <button
                  type="button"
                  onClick={() => void createGroup()}
                  className="rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-white"
                >
                  加入
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAddingGroup(true)}
                className="rounded-full border-[0.5px] border-dashed border-hairline bg-white px-3 py-1.5 text-sm text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
              >
                ＋ 新增分組
              </button>
            )}
          </div>
        </section>

        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">備註</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="聊了什麼、對方在做什麼⋯"
            className={fieldClass}
          />
        </label>

        {showMore ? (
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">聯絡帳號</span>
            <input
              type="text"
              value={lineName}
              onChange={(e) => setLineName(e.target.value)}
              className={fieldClass}
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="self-start text-sm text-ink-2 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            更多欄位（聯絡帳號）
          </button>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </main>

      {cropQueue.length > 0 && (
        <CropModal key={cropQueue[0].id} file={cropQueue[0].file} onDone={handleCropDone} />
      )}
    </div>
  );
}
