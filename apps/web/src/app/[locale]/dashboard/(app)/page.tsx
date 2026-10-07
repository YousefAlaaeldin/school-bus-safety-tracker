import { getTranslations } from 'next-intl/server';

// Placeholder: the live board is built in T4.08.
export default async function LiveBoardPage() {
  const t = await getTranslations('dashboard.live');
  return (
    <div>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-neutral-600">{t('placeholder')}</p>
    </div>
  );
}
