import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GlassHeader, { HEADER_PAD } from '../components/GlassHeader';
import { groupRepo, personRepo, photoRepo, settingsRepo } from '../data';
import type { Group, Person } from '../data/types';

interface StagedPhoto {
  key: string;
  photoId?: string; // 已存在於 repo 的照片
  file?: File; // 尚未存檔的新照片
  previewURL: string;
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
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const photosRef = useRef<StagedPhoto[]>([]);
  photosRef.current = photos;

  useEffect(() => {
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

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const added: StagedPhoto[] = Array.from(list).map((file) => ({
      key: crypto.randomUUID(),
      file,
      previewURL: URL.createObjectURL(file),
    }));
    setPhotos((prev) => {
      const next = [...prev, ...added];
      setAvatarKey((k) => k ?? next[0]?.key ?? null);
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
            {photos.map((photo) => (
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
          <div className={`flex gap-2 ${photos.length > 0 ? 'mt-2' : ''}`}>
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              className="flex-1 rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            >
              拍照
            </button>
            <button
              type="button"
              onClick={() => libraryInput.current?.click()}
              className="flex-1 rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            >
              從相簿選
            </button>
          </div>
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={libraryInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
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
    </div>
  );
}
