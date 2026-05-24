import type { Metadata } from 'next';

export const metadata: Metadata = { title: '我的投稿' };

export default function MySubmissionsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">我的投稿</h1>
      <div id="stats" className="mb-6"></div>
      <div id="submissions-list">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `
(async function() {
  const res = await fetch('/api/submissions');
  if (res.status === 401) { window.location.href = '/login'; return; }
  const json = await res.json();
  const stats = json.stats || {};
  const subs = json.data || [];

  document.getElementById('stats').innerHTML = \`
    <div class="flex gap-6 text-sm">
      <span class="text-gray-600">总投稿：<strong>\${stats.total || 0}</strong></span>
      <span class="text-gray-600">已通过：<strong class="text-green-600">\${stats.approved || 0}</strong></span>
      <span class="text-gray-600">贡献分：<strong class="text-blue-600">\${stats.contributionScore || 0}</strong></span>
    </div>
  \`;

  if (!subs.length) {
    document.getElementById('submissions-list').innerHTML = '<p class="text-gray-500">暂无投稿。<a href="/submit" class="text-blue-600">去投稿</a></p>';
    return;
  }

  const statusMap = { queued: '排队中', auto_flagged: '待复核', in_review: '审核中', approved: '已通过', rejected: '已拒绝' };
  const statusColor = { queued: 'bg-yellow-50 text-yellow-700', auto_flagged: 'bg-orange-50 text-orange-700', in_review: 'bg-blue-50 text-blue-700', approved: 'bg-green-50 text-green-700', rejected: 'bg-red-50 text-red-700' };

  document.getElementById('submissions-list').innerHTML = subs.map(s => \`
    <div class="bg-white border border-gray-200 rounded-md p-4 mb-3">
      <div class="flex items-center justify-between">
        <span class="font-medium">\${s.name}</span>
        <span class="px-2 py-0.5 rounded text-xs \${statusColor[s.status] || ''}">\${statusMap[s.status] || s.status}</span>
      </div>
      <p class="text-xs text-gray-500 mt-1">\${s.url}</p>
      <p class="text-xs text-gray-500 mt-1">\${s.short_summary || ''}</p>
      \${s.review_note ? '<p class="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">审核备注：' + s.review_note + '</p>' : ''}
      <p class="text-xs text-gray-400 mt-2">提交时间：\${new Date(s.created_at).toLocaleDateString('zh-CN')}</p>
    </div>
  \`).join('');
})();
      `}} />
    </div>
  );
}
