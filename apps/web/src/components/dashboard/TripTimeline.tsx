import { formatTime } from '@sst/i18n';
import { useTranslations } from 'next-intl';

export type TimelineEvent = {
  id: number;
  type: string;
  server_time: string;
  device_time: string | null;
  location: string | null;
  studentName: string | null;
  actorName: string | null;
};

/** Parses a PostGIS EWKB hex point (as returned by PostgREST for geography) into lat/lng. */
export function parseEwkbPoint(hex: string | null): { lat: number; lng: number } | null {
  if (!hex || hex.length < 42) return null;
  try {
    const bytes = new Uint8Array(hex.match(/../g)!.map((b) => Number.parseInt(b, 16)));
    const view = new DataView(bytes.buffer);
    const little = bytes[0] === 1;
    const type = view.getUint32(1, little);
    const hasSrid = (type & 0x20000000) !== 0;
    const offset = hasSrid ? 9 : 5;
    const lng = view.getFloat64(offset, little);
    const lat = view.getFloat64(offset + 8, little);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/** Audit timeline of a trip, oldest first. Shows the phone's time when it differs by over a minute. */
export function TripTimeline({ events, locale }: { events: TimelineEvent[]; locale: 'ar' | 'en' }) {
  const t = useTranslations('dashboard.tripDetail');
  const eventsT = useTranslations('dashboard.events');

  if (events.length === 0) return <p className="text-neutral-600">{t('noEvents')}</p>;

  return (
    <ol className="flex flex-col gap-3 border-s-2 border-emerald-200 ps-4">
      {events.map((e) => {
        const late =
          e.device_time && Math.abs(new Date(e.server_time).getTime() - new Date(e.device_time).getTime()) > 60_000;
        const point = parseEwkbPoint(e.location);
        return (
          <li key={e.id} className="flex flex-col gap-0.5">
            <span className="font-medium">
              {eventsT(e.type)}
              {e.studentName ? ` · ${e.studentName}` : ''}
            </span>
            <span className="text-sm text-neutral-600">
              <span dir="ltr">{formatTime(e.server_time, locale)}</span>
              {e.actorName ? ` · ${t('by', { name: e.actorName })}` : ''}
              {late && e.device_time ? (
                <>
                  {' · '}
                  {t('syncedLate')} ({t('deviceTime', { time: formatTime(e.device_time, locale) })})
                </>
              ) : null}
              {point ? (
                <>
                  {' · '}
                  <a
                    className="text-emerald-800 hover:underline"
                    href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('map')}
                  </a>
                </>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
