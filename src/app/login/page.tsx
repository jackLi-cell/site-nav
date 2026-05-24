import type { Metadata } from 'next';

export const metadata: Metadata = { title: '登录' };

export default function LoginPage() {
  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">登录</h1>
      <form id="login-form" className="space-y-4">
        <input id="f-email" type="email" placeholder="邮箱" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input id="f-password" type="password" placeholder="密码" required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">登录</button>
        <p id="login-error" className="text-red-500 text-xs hidden"></p>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        没有账号？<a href="/register" className="text-blue-600">注册</a>
      </p>
      <script dangerouslySetInnerHTML={{ __html: `
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('f-email').value;
  const password = document.getElementById('f-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, turnstileToken: '' })
  });
  if (res.ok) { window.location.href = '/account/submissions'; }
  else { const d = await res.json(); errEl.textContent = d.error?.message || '登录失败'; errEl.classList.remove('hidden'); }
});
      `}} />
    </div>
  );
}
