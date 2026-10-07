'use client';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export type RouteStop = { id: string; label: string; isSchool: boolean };

function Row({ stop, index, onRemove }: { stop: RouteStop; index: number; onRemove: () => void }) {
  const t = useTranslations('dashboard.route');
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stop.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-2"
    >
      <button
        type="button"
        aria-label={t('dragHandle')}
        className="min-h-10 min-w-10 cursor-grab touch-none rounded-lg text-neutral-500 hover:bg-neutral-100"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="flex size-7 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">{index + 1}</span>
      <span className="flex-1">
        {stop.label} {stop.isSchool ? '🏫' : ''}
      </span>
      <Button variant="ghost" onClick={onRemove}>{t('remove')}</Button>
    </li>
  );
}

/** Add, remove and drag-reorder the stops of a route, then rewrite route_stops. */
export function RouteStopsEditor({
  routeId,
  direction,
  initial,
  available,
}: {
  routeId: string;
  direction: 'to_school' | 'from_school';
  initial: RouteStop[];
  /** Every stop of the school. */
  available: RouteStop[];
}) {
  const t = useTranslations('dashboard.route');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [stops, setStops] = useState(initial);
  const [pick, setPick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSaved(false);
    setStops((list) => {
      const from = list.findIndex((s) => s.id === active.id);
      const to = list.findIndex((s) => s.id === over.id);
      return arrayMove(list, from, to);
    });
  };

  const free = available.filter((a) => !stops.some((s) => s.id === a.id));
  const first = stops[0];
  const last = stops[stops.length - 1];
  const warning =
    stops.length > 0 && direction === 'from_school' && !first?.isSchool
      ? t('warnStartSchool')
      : stops.length > 0 && direction === 'to_school' && !last?.isSchool
        ? t('warnEndSchool')
        : null;

  const save = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = createClient();
      // Delete first, then insert 1..n, to avoid unique conflicts on (route_id, sequence).
      const { error: delErr } = await supabase.from('route_stops').delete().eq('route_id', routeId);
      if (delErr) throw delErr;
      if (stops.length > 0) {
        const { error: insErr } = await supabase
          .from('route_stops')
          .insert(stops.map((s, i) => ({ route_id: routeId, stop_id: s.id, sequence: i + 1 })));
        if (insErr) throw insErr;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(errorsT('UNKNOWN'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{t('stops')}</h2>
      {warning ? <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{warning}</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {stops.map((s, i) => (
              <Row
                key={s.id}
                stop={s}
                index={i}
                onRemove={() => {
                  setSaved(false);
                  setStops((list) => list.filter((x) => x.id !== s.id));
                }}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-end gap-2">
        {free.length > 0 ? (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('addStop')}
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-base"
              >
                <option value="">{t('chooseStop')}</option>
                {free.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={!pick}
              onClick={() => {
                const stop = available.find((a) => a.id === pick);
                if (stop) setStops((list) => [...list, stop]);
                setPick('');
                setSaved(false);
              }}
            >
              {t('add')}
            </Button>
          </>
        ) : (
          <p className="text-sm text-neutral-500">{t('noStopsLeft')}</p>
        )}
      </div>

      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-800">{t('saved')}</p> : null}
      <div>
        <Button onClick={() => void save()} loading={loading}>{t('saveStops')}</Button>
      </div>
    </section>
  );
}
