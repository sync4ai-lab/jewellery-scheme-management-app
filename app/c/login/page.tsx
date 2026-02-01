'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('mounted');
  }, []);

  // still NO JSX
}
