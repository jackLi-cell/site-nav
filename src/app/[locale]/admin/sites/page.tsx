export default function AdminSitesPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">网站管理</h1>
        <button id="show-add-form" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">新增网站</button>
      </div>

      <div id="add-form" className="hidden bg-white border border-gray-200 rounded-md p-5 mb-6">
        <h2 className="font-semibold mb-3">新增网站</h2>
        <div className="space-y-3">
          <input id="f-name" placeholder="网站名称" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
          <input id="f-url" placeholder="网站 URL (https://...)" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
          <input id="f-summary" placeholder="一句话简介" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
          <input id="f-keywords" placeholder="关键词（逗号分隔）" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
          <div className="flex gap-2">
            <button id="submit-site" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">提交</button>
            <button id="hide-add-form" className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm">取消</button>
          </div>
        </div>
      </div>

      <div id="sites-table">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
function showAddForm() { document.getElementById('add-form').classList.remove('hidden'); }
function hideAddForm() { document.getElementById('add-form').classList.add('hidden'); }
document.getElementById('show-add-form').addEventListener('click', showAddForm);
document.getElementById('hide-add-form').addEventListener('click', hideAddForm);
document.getElementById('submit-site').addEventListener('click', submitSite);

async function submitSite() {
  const name = document.getElementById('f-name').value.trim();
  const url = document.getElementById('f-url').value.trim();
  const shortSummary = document.getElementById('f-summary').value.trim();
  const kws = document.getElementById('f-keywords').value.trim();
  if (!name || !url) { alert('名称和 URL 必填'); return; }
  const keywordNames = kws ? kws.split(',').map(k => k.trim()).filter(Boolean) : [];
  const res = await fetch('/api/admin/sites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, shortSummary, keywordNames })
  });
  if (res.ok) { hideAddForm(); loadSites(); } else { const e = await res.json(); alert(e.error?.message || '提交失败'); }
}

async function deleteSite(id) {
  if (!confirm('确认删除？')) return;
  await fetch('/api/admin/sites/' + id, { method: 'DELETE' });
  loadSites();
}

async function loadSites() {
  const res = await fetch('/api/admin/sites?limit=100');
  const json = await res.json();
  const sites = json.data || [];
  document.getElementById('sites-table').innerHTML = \`
    <table class="w-full text-sm">
      <thead><tr class="border-b text-left text-gray-500">
        <th class="py-2">名称</th><th>域名</th><th>状态</th><th>点击</th><th>操作</th>
      </tr></thead>
      <tbody>\${sites.map(s => \`
        <tr class="border-b">
          <td class="py-2 font-medium">\${s.name}</td>
          <td class="text-gray-500">\${s.normalizedDomain}</td>
          <td><span class="px-2 py-0.5 rounded text-xs \${s.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">\${s.status}</span></td>
          <td>\${s.viewCount}</td>
          <td><button onclick="deleteSite('\${s.id}')" class="text-red-500 text-xs hover:underline">删除</button></td>
        </tr>
      \`).join('')}</tbody>
    </table>
  \`;
}
loadSites();
          `,
        }}
      />
    </>
  );
}
