export default function AdminCategoriesPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">分类管理</h1>
        <button id="show-add-form" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">新增分类</button>
      </div>

      <div id="add-form" className="hidden bg-white border border-gray-200 rounded-md p-5 mb-6">
        <h2 className="font-semibold mb-3">新增分类</h2>
        <div className="space-y-3">
          <input id="f-name" placeholder="分类名称" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
          <input id="f-slug" placeholder="URL 标识 (英文)" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
          <input id="f-desc" placeholder="分类说明（可选）" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
          <div className="flex gap-2">
            <button id="submit-category" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">提交</button>
            <button id="hide-add-form" className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm">取消</button>
          </div>
        </div>
      </div>

      <div id="categories-table">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
function showAddForm() { document.getElementById('add-form').classList.remove('hidden'); }
function hideAddForm() { document.getElementById('add-form').classList.add('hidden'); }
document.getElementById('show-add-form').addEventListener('click', showAddForm);
document.getElementById('hide-add-form').addEventListener('click', hideAddForm);
document.getElementById('submit-category').addEventListener('click', submitCategory);

async function submitCategory() {
  const name = document.getElementById('f-name').value.trim();
  const slug = document.getElementById('f-slug').value.trim();
  const description = document.getElementById('f-desc').value.trim();
  if (!name || !slug) { alert('名称和 slug 必填'); return; }
  const res = await fetch('/api/admin/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, slug, description })
  });
  if (res.ok) { hideAddForm(); loadCategories(); } else { const e = await res.json(); alert(e.error?.message || '提交失败'); }
}

async function loadCategories() {
  const res = await fetch('/api/admin/categories');
  const json = await res.json();
  const cats = json.data || [];
  document.getElementById('categories-table').innerHTML = \`
    <table class="w-full text-sm">
      <thead><tr class="border-b text-left text-gray-500">
        <th class="py-2">名称</th><th>Slug</th><th>说明</th><th>排序</th>
      </tr></thead>
      <tbody>\${cats.map(c => \`
        <tr class="border-b">
          <td class="py-2 font-medium">\${c.name}</td>
          <td class="text-gray-500">\${c.slug}</td>
          <td class="text-gray-500 text-xs">\${c.description || '-'}</td>
          <td>\${c.sortOrder}</td>
        </tr>
      \`).join('')}</tbody>
    </table>
  \`;
}
loadCategories();
          `,
        }}
      />
    </>
  );
}
