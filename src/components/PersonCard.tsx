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
      className="block overflow-hidden rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
    >
      <div className="aspect-square w-full bg-ground">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-4xl text-ink-2"
          >
            {person.displayName.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate font-medium">{person.displayName}</p>
          {dots.length > 0 && (
            <div className="flex shrink-0 gap-1">
              {dots.map((g) => (
                <span
                  key={g.id}
                  title={g.name}
                  className="h-2 w-2 rounded-full"
                  style={{ background: g.color }}
                />
              ))}
            </div>
          )}
        </div>
        {person.occasion && (
          <p className="mt-0.5 truncate text-sm text-ink-2">{person.occasion}</p>
        )}
      </div>
    </Link>
  );
}
