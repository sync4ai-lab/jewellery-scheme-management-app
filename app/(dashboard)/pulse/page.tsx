

import PulseDashboardClient from './PulseDashboardClient';
import { cookies } from 'next/headers';

export default async function PulseDashboard() {
  // Use absolute URL for API route fetch in server component
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const res = await fetch(`${baseUrl}/api/dashboard/pulse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    },
    cache: 'no-store',
    // credentials: 'include' // Not needed when manually forwarding cookies
  });
  if (!res.ok) {
    return <div>Access denied</div>;
  }
  const { analytics, todayLabel } = await res.json();
  return (
    <PulseDashboardClient
      initialAnalytics={analytics}
      initialRates={analytics.currentRates}
      todayLabel={todayLabel}
    />
  );
}


