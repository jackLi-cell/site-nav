import type { Metadata } from 'next';

export const metadata: Metadata = { title: '投稿网站' };

export default function SubmitPage() {
  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">投稿网站</h1>
      <p className="text-gray-600 mb-6 text-sm">推荐一个优质网站，审核通过后将出现在目录中。</p>
      <form id="submit-form" className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">网站名称 *</label>
          <input id="f-name" type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">网站 URL *</label>
          <input id="f-url" type="url" placeholder="https://..." required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">一句话简介 *</label>
          <input id="f-summary" type="text" required maxLength={200} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">详细描述（可选）</label>
          <textarea id="f-desc" rows={3} maxLength={2000} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">关键词（逗号分隔，可选）</label>
          <input id="f-keywords" type="text" placeholder="AI, 免费, 开源" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">提交投稿</button>
        <p id="submit-msg" className="text-sm hidden"></p>
      </form>
      <script dangerouslySetInnerHTML={{ __html: `
document.getElementById('submit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('submit-msg');
  msgEl.classList.add('hidden');

  const name = document.getElementById('f-name').value.trim();
  const url = document.getElementById('f-url').value.trim();
  const shortSummary = document.getElementById('f-summary').value.trim();
  const fullDescription = document.getElementById('f-desc').value.trim();
  const kwStr = document.getElementById('f-keywords').value.trim();
  const keywords = kwStr ? kwStr.split(',').map(k => k.trim()).filter(Boolean) : [];

  const res = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, shortSummary, fullDescription, keywords, turnstileToken: '' })
  });

  if (res.ok) {
    msgEl.textContent = '投稿成功！等待审核中。';
    msgEl.className = 'text-sm text-green-600';
    msgEl.classList.remove('hidden');
    document.getElementById('submit-form').reset();
  } else if (res.status === 401) {
    window.location.href = '/login';
  } else {
    const d = await res.json();
    msgEl.textContent = d.error?.message || '提交失败';
    msgEl.className = 'text-sm text-red-500';
    msgEl.classList.remove('hidden');
  }
});
      `}} />
    </div>
  );
}
