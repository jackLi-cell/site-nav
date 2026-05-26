'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDictionary } from '@/i18n/dictionary-context';

export default function RegisterPage() {
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, turnstileToken: '' }),
    });

    if (res.ok) {
      window.location.href = `${prefix}/account/submissions`;
    } else {
      const d = await res.json();
      setError(d.error?.message || 'Registration failed');
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">{dict.register.title}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="name" type="text" placeholder={dict.register.username} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input name="email" type="email" placeholder={dict.register.email} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input name="password" type="password" placeholder={dict.register.password} required minLength={8} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">{dict.register.registerBtn}</button>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        {dict.register.hasAccount} <Link href={`${prefix}/login`} className="text-blue-600">{dict.register.login}</Link>
      </p>
    </div>
  );
}
