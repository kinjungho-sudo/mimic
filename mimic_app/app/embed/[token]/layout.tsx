import type { Metadata } from 'next';
import { buildEmbedMetadata } from '@/lib/share-metadata';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return buildEmbedMetadata(token);
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
