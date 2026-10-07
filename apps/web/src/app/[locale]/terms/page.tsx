import { LegalPage } from '@/components/LegalPage';

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage locale={locale} page="terms" sections={['use', 'accuracy', 'changes', 'law']} />;
}
