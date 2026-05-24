import type { Metadata } from 'next';

export const metadata: Metadata = { title: '注册' };

export default function RegisterPage() {
  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">注册</h1>
      <form id="register-form" className="space-y-4">
        <input id="f-name" type="text" placeholder="显示名称" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input id="f-email" type="email" placeholder="邮箱" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input id="f-password" type="password" placeholder="密码（至少 8 位）" required minLength={8} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">注册</button>
        <p id="register-error" className="text-red-500 text-xs hidden"></p>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        已有账号？<a href="/login" className="text-blue-600">登录</a>
      </p>
      <script dangerouslySetInnerHTML={{ __html: `
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('f-name').value;
  const email = document.getElementById('f-email').value;
  const password = document.getElementById('f-password').value;
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, turnstileToken: '' })
  });
  if (res.ok) { window.location.href = '/account/submissions'; }
  else { const d = await res.json(); errEl.textContent = d.error?.message || '注册失败'; errEl.classList.remove('hidden'); }
});
      `}} />
    </div>
  );
}
