import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const headersList = await headers();
  const role = headersList.get('x-user-role');

  if (!role) redirect('/login');
  if (role === 'super_admin') redirect('/super-admin');
  if (role === 'parent' || role === 'student') redirect('/mobile');
  redirect('/calendar');
}
