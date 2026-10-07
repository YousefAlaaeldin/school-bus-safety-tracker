import { LegalPage } from '@/components/LegalPage';

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage locale={locale} page="support" sections={['code', 'child', 'contact']} />;
}
