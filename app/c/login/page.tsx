'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('mounted');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        Customer Login
      </div>
    </div>
  );
}
