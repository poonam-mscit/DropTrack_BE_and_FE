'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MobileHome() {
  const router = useRouter();
  useEffect(() => router.replace('/m/jobs'), [router]);
  return null;
}
