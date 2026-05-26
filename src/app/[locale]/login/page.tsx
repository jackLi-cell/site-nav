'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDictionary } from '@/i18n/dictionary-context';

export default function LoginPage() {
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, turnstileToken: '' }),
    });

    if (res.ok) {
      window.location.href = `${prefix}/account/submissions`;
    } else {
      const d = await res.json();
      setError(d.error?.message || 'Login failed');
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">{dict.login.title}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="email" type="email" placeholder={dict.login.email} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input name="password" type="password" placeholder={dict.login.password} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">{dict.login.loginBtn}</button>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        {dict.login.noAccount} <Link href={`${prefix}/register`} className="text-blue-600">{dict.login.register}</Link>
      </p>
    </div>
  );
}
