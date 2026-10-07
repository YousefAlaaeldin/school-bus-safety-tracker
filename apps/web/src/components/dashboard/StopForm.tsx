'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { PinPicker, type LatLng } from '@/components/maps/PinPicker';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export type Stop = {
  id: string;
  label_en: string;
  label_ar: string;
  area: string | null;
  building: string | null;
  makani_number: string | null;
  landmark_notes: string | null;
  is_school: boolean;
  lat: number;
  lng: number;
};

/** A button that opens a create/edit dialog for a stop. Pass `stop` to edit. */
export function StopForm({ schoolId, stop, schoolPoint }: { schoolId: string; stop?: Stop; schoolPoint?: LatLng | null }) {
  const t = useTranslations('dashboard.stops');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  const [open, setOpen] = useState(false);
  const [labelEn, setLabelEn] = useState(stop?.label_en ?? '');
  const [labelAr, setLabelAr] = useState(stop?.label_ar ?? '');
  const [area, setArea] = useState(stop?.area ?? '');
  const [building, setBuilding] = useState(stop?.building ?? '');
  const [makani, setMakani] = useState(stop?.makani_number ?? '');
  const [landmark, setLandmark] = useState(stop?.landmark_notes ?? '');
  const [isSchool, setIsSchool] = useState(stop?.is_school ?? false);
  const [point, setPoint] = useState<LatLng | null>(stop ? { lat: stop.lat, lng: stop.lng } : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!labelEn.trim()) next.en = t('labelRequired');
    if (!labelAr.trim()) next.ar = t('labelRequired');
    if (makani.trim() && !/^\d{10}$/.test(makani.trim())) next.makani = t('makaniInvalid');
    if (!point) next.pin = t('pinRequired');
    setErrors(next);
    if (Object.keys(next).length > 0 || !point) return;

    setLoading(true);
    setError(null);
    try {
      const values = {
        label_en: labelEn.trim(),
        label_ar: labelAr.trim(),
        area: area.trim() || null,
        building: building.trim() || null,
        makani_number: makani.trim() || null,
        landmark_notes: landmark.trim() || null,
        is_school: isSchool,
        // PostgREST accepts extended WKT for geography columns.
        location: `SRID=4326;POINT(${point.lng} ${point.lat})`,
      };
      const supabase = createClient();
      const { error: err } = stop
        ? await supabase.from('stops').update(values).eq('id', stop.id)
        : await supabase.from('stops').insert({ ...values, school_id: schoolId });
      if (err) {
        setError(errorsT('UNKNOWN'));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant={stop ? 'ghost' : 'primary'} onClick={() => setOpen(true)}>
        {stop ? t('edit') : t('new')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={stop ? t('edit') : t('new')}>
        <form onSubmit={submit} className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto">
          <Input label={t('labelEn')} value={labelEn} onChange={(e) => setLabelEn(e.target.value)} dir="ltr" error={errors.en} />
          <Input label={t('labelAr')} value={labelAr} onChange={(e) => setLabelAr(e.target.value)} dir="rtl" error={errors.ar} />
          <Input label={t('area')} value={area} onChange={(e) => setArea(e.target.value)} />
          <Input label={t('building')} value={building} onChange={(e) => setBuilding(e.target.value)} />
          <Input
            label={t('makani')}
            value={makani}
            onChange={(e) => setMakani(e.target.value.replace(/\D/g, '').slice(0, 10))}
            inputMode="numeric"
            dir="ltr"
            error={errors.makani}
          />
          <Input label={t('landmark')} value={landmark} onChange={(e) => setLandmark(e.target.value)} />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4" checked={isSchool} onChange={(e) => setIsSchool(e.target.checked)} />
            {t('isSchool')}
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t('pin')}</span>
            {apiKey ? (
              <>
                <p className="text-xs text-neutral-500">{t('pinHelp')}</p>
                <PinPicker value={point} center={schoolPoint} onChange={setPoint} apiKey={apiKey} />
              </>
            ) : (
              <p className="text-xs text-neutral-500">{t('noMapKey')}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t('lat')}
                dir="ltr"
                inputMode="decimal"
                value={point ? String(point.lat) : ''}
                onChange={(e) => {
                  const lat = Number(e.target.value);
                  if (Number.isFinite(lat)) setPoint({ lat, lng: point?.lng ?? 55.2708 });
                }}
              />
              <Input
                label={t('lng')}
                dir="ltr"
                inputMode="decimal"
                value={point ? String(point.lng) : ''}
                onChange={(e) => {
                  const lng = Number(e.target.value);
                  if (Number.isFinite(lng)) setPoint({ lat: point?.lat ?? 25.2048, lng });
                }}
              />
            </div>
            {errors.pin ? <p className="text-sm text-red-700">{errors.pin}</p> : null}
          </div>

          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" loading={loading}>{t('save')}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function StopDeleteButton({ stopId }: { stopId: string }) {
  const t = useTranslations('dashboard.stops');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await createClient().from('stops').delete().eq('id', stopId);
      if (err) {
        // 23503 = foreign key violation: a route, assignment or trip still uses this stop.
        setError(err.code === '23503' ? t('inUse') : errorsT('UNKNOWN'));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>{t('delete')}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('delete')}>
        <p>{t('deleteConfirm')}</p>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="danger" loading={loading} onClick={() => void remove()}>{t('delete')}</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Button>
        </div>
      </Dialog>
    </>
  );
}
