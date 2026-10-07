import { LegalPage } from '@/components/LegalPage';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage locale={locale} page="privacy" sections={['collect', 'who', 'retention', 'children', 'contact', 'law']} />;
}
