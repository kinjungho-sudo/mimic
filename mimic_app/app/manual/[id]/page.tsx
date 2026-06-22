import { redirect } from 'next/navigation';

export default function ManualPage({ params }: { params: { id: string } }) {
  redirect(`/manual/${params.id}/editor`);
}
