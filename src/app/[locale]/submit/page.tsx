'use client';

import { useDictionary } from '@/i18n/dictionary-context';
import { useState } from 'react';

export default function SubmitPage() {
  const { dict, locale } = useDictionary();
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get('name') as string).trim();
    const url = (formData.get('url') as string).trim();
    const shortSummary = (formData.get('summary') as string).trim();
    const fullDescription = (formData.get('desc') as string).trim();
    const kwStr = (formData.get('keywords') as string).trim();
    const keywords = kwStr ? kwStr.split(',').map(k => k.trim()).filter(Boolean) : [];

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, shortSummary, fullDescription, keywords, turnstileToken: '' }),
      });

      if (res.ok) {
        setMsg({ text: dict.submit.success, type: 'success' });
        form.reset();
      } else if (res.status === 401) {
        window.location.href = `/${locale}/login`;
      } else {
        const d = await res.json();
        setMsg({ text: d.error?.message || dict.submit.error, type: 'error' });
      }
    } catch {
      setMsg({ text: dict.submit.error, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">{dict.submit.title}</h1>
      <p className="text-gray-600 mb-6 text-sm">{dict.submit.description}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{dict.submit.siteName} *</label>
          <input name="name" type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{dict.submit.siteUrl} *</label>
          <input name="url" type="url" placeholder="https://..." required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{dict.submit.siteDescription} *</label>
          <input name="summary" type="text" required maxLength={200} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{dict.submit.category}</label>
          <input name="keywords" type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <textarea name="desc" rows={3} maxLength={2000} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? dict.submit.submitting : dict.submit.submitBtn}
        </button>
        {msg && (
          <p className={`text-sm ${msg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {msg.text}
          </p>
        )}
      </form>
    </div>
  );
}
