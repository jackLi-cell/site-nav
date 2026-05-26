export default function AdminKeywordsPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">关键词管理</h1>
        <button id="show-add-form" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">新增关键词</button>
      </div>

      <div id="add-form" className="hidden bg-white border border-gray-200 rounded-md p-5 mb-6">
        <div className="flex gap-2">
          <input id="f-name" placeholder="关键词" className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" />
          <button id="submit-keyword" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">添加</button>
          <button id="hide-add-form" className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm">取消</button>
        </div>
      </div>

      <div id="keywords-list">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
function showAddForm() { document.getElementById('add-form').classList.remove('hidden'); }
function hideAddForm() { document.getElementById('add-form').classList.add('hidden'); }
document.getElementById('show-add-form').addEventListener('click', showAddForm);
document.getElementById('hide-add-form').addEventListener('click', hideAddForm);
document.getElementById('submit-keyword').addEventListener('click', submitKeyword);

async function submitKeyword() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { alert('关键词不能为空'); return; }
  const res = await fetch('/api/admin/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (res.ok) { document.getElementById('f-name').value = ''; loadKeywords(); }
  else { const e = await res.json(); alert(e.error?.message || '添加失败'); }
}

async function loadKeywords() {
  const res = await fetch('/api/admin/keywords');
  const json = await res.json();
  const kws = json.data || [];
  document.getElementById('keywords-list').innerHTML = \`
    <div class="flex flex-wrap gap-2">
      \${kws.map(k => '<span class="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm">' + k.name + '</span>').join('')}
    </div>
    <p class="text-xs text-gray-400 mt-4">共 \${kws.length} 个关键词</p>
  \`;
}
loadKeywords();
          `,
        }}
      />
    </>
  );
}
