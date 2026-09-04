import { useEffect, useState } from 'react';
import { photoRepo } from '../data';

/** 取得照片 URL，unmount 時自動釋放，避免記憶體洩漏 */
export function usePhotoURL(
  photoId: string | undefined,
  variant: 'full' | 'thumb' = 'full'
): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!photoId) {
      setUrl(undefined);
      return;
    }
    let cancelled = false;
    let current: string | undefined;

    photoRepo
      .getURL(photoId, variant)
      .then((u) => {
        if (cancelled) {
          photoRepo.releaseURL(u);
          return;
        }
        current = u;
        setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined);
      });

    return () => {
      cancelled = true;
      if (current) photoRepo.releaseURL(current);
    };
  }, [photoId, variant]);

  return url;
}
