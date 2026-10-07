'use client';

import Papa from 'papaparse';
import { useTranslations } from 'next-intl';
import { useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

const COLUMNS = [
  'name_en',
  'name_ar',
  'grade',
  'guardian_phone',
  'relationship',
  'guardian2_phone',
  'relationship2',
] as const;

type RosterRow = Record<(typeof COLUMNS)[number], string>;
type RowError = { row: number; code: string };

export function RosterImport({ schoolId }: { schoolId: string }) {
  const t = useTranslations('dashboard.import');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setRows([]);
    setRowErrors([]);
    setMessage(null);
    setError(null);
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      transformHeader: (h) => h.replace(/^﻿/, '').trim(),
      complete: (result) => {
        setRows(
          result.data.map((r) => {
            const row = {} as RosterRow;
            for (const c of COLUMNS) row[c] = (r[c] ?? '').trim();
            return row;
          }),
        );
      },
      error: () => setError(errorsT('UNKNOWN')),
    });
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setRowErrors([]);
    try {
      const payload = rows.map((r) => ({
        name_en: r.name_en,
        name_ar: r.name_ar,
        grade: r.grade || undefined,
        guardian_phone: r.guardian_phone || undefined,
        relationship: r.relationship || undefined,
        guardian2_phone: r.guardian2_phone || undefined,
        relationship2: r.relationship2 || undefined,
      }));
      const { data, error: err } = await createClient().rpc('import_roster', {
        p_school_id: schoolId,
        p_rows: payload,
      });
      if (err) {
        const known = ['NOT_AUTHORIZED', 'INVALID_INPUT'];
        setError(errorsT(known.includes(err.message) ? err.message : 'UNKNOWN'));
        return;
      }
      const result = data as unknown as { students_created: number; links_created: number; errors: RowError[] };
      if (result.errors.length > 0) {
        setRowErrors(result.errors);
        return;
      }
      setMessage(t('done', { students: result.students_created, links: result.links_created }));
      setRows([]);
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  const errorsByRow = new Map<number, string[]>();
  for (const e of rowErrors) errorsByRow.set(e.row, [...(errorsByRow.get(e.row) ?? []), e.code]);

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-neutral-700">{t('help')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <a href="/roster-template.csv" download className="text-sm font-medium text-emerald-800 hover:underline">
          {t('template')}
        </a>
        <input type="file" accept=".csv,text/csv" onChange={onFile} aria-label={t('choose')} />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">{message}</p> : null}
      {rowErrors.length > 0 ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {t('fixErrors')}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <h2 className="text-lg font-bold">
            {t('preview')} · {t('rows', { count: rows.length })}
          </h2>
          <Table
            rows={rows.map((r, i) => ({ ...r, n: i + 1 }))}
            rowKey={(r) => String(r.n)}
            columns={[
              { key: 'n', header: t('row'), render: (r) => r.n },
              ...COLUMNS.map((c) => ({
                key: c,
                header: c,
                render: (r: RosterRow & { n: number }) => (
                  <span dir={c.startsWith('guardian') ? 'ltr' : undefined}>{r[c]}</span>
                ),
              })),
              {
                key: 'issues',
                header: '',
                render: (r) => (
                  <span className="text-red-700">
                    {(errorsByRow.get(r.n) ?? []).map((code) => t(`errors.${code}`)).join(' · ')}
                  </span>
                ),
              },
            ]}
          />
          <div>
            <Button onClick={() => void run()} loading={loading}>
              {t('run')}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
