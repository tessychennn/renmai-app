import { Link } from 'react-router-dom';
import { usePhotoURL } from '../hooks/usePhotoURL';
import type { Group, Person } from '../data/types';

export default function PersonCard({ person, groups }: { person: Person; groups: Group[] }) {
  const avatarId = person.avatarPhotoId ?? person.photoIds[0];
  const url = usePhotoURL(avatarId, 'thumb');
  const dots = person.groupIds
    .map((id) => groups.find((g) => g.id === id))
    .filter((g): g is Group => Boolean(g));

  return (
    <Link
      to={`/person/${person.id}`}
      className="flex items-center gap-3 rounded-2xl border-[0.5px] border-hairline bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
    >
      {url ? (
        <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ground text-lg text-ink-2"
        >
          {person.displayName.slice(0, 1)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{person.displayName}</p>
        {person.occasion && <p className="mt-0.5 truncate text-sm text-ink-2">{person.occasion}</p>}
      </div>
      {dots.length > 0 && (
        <div className="flex shrink-0 gap-1">
          {dots.map((g) => (
            <span
              key={g.id}
              title={g.name}
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: g.color }}
            />
          ))}
        </div>
      )}
    </Link>
  );
}
