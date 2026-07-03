import { redirect } from 'next/navigation';

type PageProps = {
  params: { id: string };
};

export default function LiveStudioRedirectPage({ params }: PageProps) {
  redirect(`/manual/${params.id}/studio`);
}
