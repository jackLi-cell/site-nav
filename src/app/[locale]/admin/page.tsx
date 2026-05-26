export default function AdminDashboard() {
  return (
    <>
      <h1 className="text-2xl font-bold mb-6">管理后台</h1>
      <div id="admin-stats" className="grid grid-cols-3 gap-4">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
(async function() {
  const res = await fetch('/api/admin/stats');
  const json = await res.json();
  const s = json.data || {};
  document.getElementById('admin-stats').innerHTML = \`
    <div class="bg-white border border-gray-200 rounded-md p-5 text-center">
      <div class="text-3xl font-bold text-blue-600">\${s.totalSites || 0}</div>
      <div class="text-sm text-gray-500 mt-1">收录网站</div>
    </div>
    <div class="bg-white border border-gray-200 rounded-md p-5 text-center">
      <div class="text-3xl font-bold text-blue-600">\${s.totalCategories || 0}</div>
      <div class="text-sm text-gray-500 mt-1">分类数</div>
    </div>
    <div class="bg-white border border-gray-200 rounded-md p-5 text-center">
      <div class="text-3xl font-bold text-blue-600">\${s.weeklyClicks || 0}</div>
      <div class="text-sm text-gray-500 mt-1">本周点击</div>
    </div>
  \`;
})();
          `,
        }}
      />
    </>
  );
}
