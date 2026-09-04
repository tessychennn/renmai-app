import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmSheet from '../components/ConfirmSheet';
import GlassHeader, { HEADER_PAD } from '../components/GlassHeader';
import { deletePersonWithPhotos, groupRepo, personRepo } from '../data';
import { usePhotoURL } from '../hooks/usePhotoURL';
import type { Group, Person } from '../data/types';

function PhotoSlide({ photoId }: { photoId: string }) {
  const url = usePhotoURL(photoId, 'full');
  return (
    <div className="w-full shrink-0 snap-center">
      {url && (
        <img
          src={url}
          alt=""
          className="max-h-[60vh] w-full rounded-2xl bg-white object-contain"
        />
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return iso.replaceAll('-', '/');
}

export default function PersonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Person | null | undefined>(undefined);
  const [groups, setGroups] = useState<Group[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    void personRepo.get(id).then(setPerson);
    void groupRepo.list().then(setGroups);
  }, [id]);

  const remove = async () => {
    if (!id) return;
    await deletePersonWithPhotos(id);
    navigate('/', { state: { toast: '已刪除' } });
  };

  if (person === undefined) return <div className="min-h-dvh" />;
  if (person === null) {
    return (
      <div className="min-h-dvh">
        <GlassHeader title="找不到這個人" back />
        <main className="px-5 text-center text-ink-2" style={{ paddingTop: HEADER_PAD }}>
          <p>可能已被刪除。</p>
        </main>
      </div>
    );
  }

  const personGroups = person.groupIds
    .map((gid) => groups.find((g) => g.id === gid))
    .filter((g): g is Group => Boolean(g));

  const rows: Array<{ label: string; value: string }> = [];
  if (person.occasion) rows.push({ label: '場合', value: person.occasion });
  if (person.metDate) rows.push({ label: '認識日期', value: formatDate(person.metDate) });
  if (person.lineName) rows.push({ label: '聯絡帳號', value: person.lineName });

  return (
    <div className="min-h-dvh">
      <GlassHeader
        title={person.displayName}
        back
        right={
          <Link
            to={`/person/${person.id}/edit`}
            className="rounded-full border-[0.5px] border-hairline bg-white px-4 py-1.5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            編輯
          </Link>
        }
      />

      <main
        className="flex flex-col gap-5 px-5"
        style={{
          paddingTop: HEADER_PAD,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)',
        }}
      >
        {person.photoIds.length > 0 && (
          <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 [scrollbar-width:none]">
            {person.photoIds.map((photoId) => (
              <PhotoSlide key={photoId} photoId={photoId} />
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <section className="rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`flex items-baseline justify-between gap-4 px-4 py-3 ${
                  i > 0 ? 'border-t-[0.5px] border-hairline' : ''
                }`}
              >
                <span className="shrink-0 text-sm text-ink-2">{row.label}</span>
                <span className="text-right">{row.value}</span>
              </div>
            ))}
          </section>
        )}

        {personGroups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {personGroups.map((group) => (
              <span
                key={group.id}
                className="flex items-center gap-1.5 rounded-full border-[0.5px] border-hairline bg-white px-3 py-1.5 text-sm"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
                {group.name}
              </span>
            ))}
          </div>
        )}

        {person.note && (
          <p className="whitespace-pre-wrap rounded-2xl border-[0.5px] border-hairline bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            {person.note}
          </p>
        )}

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-4 self-center text-sm font-medium text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
        >
          刪除這個人
        </button>
      </main>

      <ConfirmSheet
        open={confirmOpen}
        title={`刪除 ${person.displayName}？`}
        message="照片會一併刪除，無法復原。"
        actions={[{ label: '刪除', danger: true, onClick: () => void remove() }]}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
