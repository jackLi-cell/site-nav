export default function AdminSubmissionsPage() {
  return (
    <>
      <h1 className="text-xl font-bold mb-4">投稿审核</h1>
      <div className="flex gap-2 mb-4">
        <button data-status-filter="" className="px-3 py-1 bg-gray-100 rounded text-sm">全部</button>
        <button data-status-filter="queued" className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded text-sm">排队中</button>
        <button data-status-filter="auto_flagged" className="px-3 py-1 bg-orange-50 text-orange-700 rounded text-sm">待复核</button>
      </div>
      <div id="batch-bar" className="hidden mb-4 p-3 bg-blue-50 rounded flex items-center gap-3">
        <span id="selected-count" className="text-sm text-blue-700"></span>
        <button id="batch-approve" className="px-3 py-1 bg-green-600 text-white rounded text-xs">批量通过</button>
        <button id="batch-reject" className="px-3 py-1 bg-red-600 text-white rounded text-xs">批量拒绝</button>
      </div>
      <div id="subs-list">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `
let selected = new Set();

async function loadSubs(status) {
  selected.clear();
  updateBatchBar();
  const url = '/api/admin/submissions' + (status ? '?status=' + status : '');
  const res = await fetch(url);
  if (res.status === 403) { alert('权限不足'); return; }
  const json = await res.json();
  const subs = json.data || [];

  const statusMap = { queued: '排队中', auto_flagged: '待复核', in_review: '审核中', approved: '已通过', rejected: '已拒绝' };

  document.getElementById('subs-list').innerHTML = subs.length ? subs.map(s => \`
    <div class="bg-white border border-gray-200 rounded-md p-4 mb-3">
      <div class="flex items-center gap-3">
        <input type="checkbox" data-id="\${s.id}" onchange="toggleSelect('\${s.id}')" class="shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium">\${s.name}</span>
            <span class="text-xs px-1.5 py-0.5 bg-gray-100 rounded">\${statusMap[s.status] || s.status}</span>
          </div>
          <p class="text-xs text-blue-600 truncate">\${s.url}</p>
          <p class="text-xs text-gray-500 mt-1">\${s.short_summary || ''}</p>
          \${s.flag_reason ? '<p class="text-xs text-orange-600 mt-1">⚠ ' + s.flag_reason + '</p>' : ''}
          <p class="text-xs text-gray-400 mt-1">投稿人：\${s.submitter_name || '未知'} · \${new Date(s.created_at).toLocaleDateString('zh-CN')}</p>
        </div>
        <div class="flex gap-2 shrink-0">
          <button onclick="reviewSingle('\${s.id}','approve')" class="px-2 py-1 bg-green-50 text-green-700 rounded text-xs hover:bg-green-100">通过</button>
          <button onclick="reviewSingle('\${s.id}','reject')" class="px-2 py-1 bg-red-50 text-red-700 rounded text-xs hover:bg-red-100">拒绝</button>
        </div>
      </div>
    </div>
  \`).join('') : '<p class="text-gray-500">暂无投稿</p>';
}

function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  updateBatchBar();
}

function updateBatchBar() {
  const bar = document.getElementById('batch-bar');
  if (selected.size > 0) {
    bar.classList.remove('hidden');
    document.getElementById('selected-count').textContent = '已选 ' + selected.size + ' 条';
  } else {
    bar.classList.add('hidden');
  }
}

async function reviewSingle(id, action) {
  const note = action === 'reject' ? prompt('拒绝原因（可选）：') : '';
  const res = await fetch('/api/admin/submissions/' + id + '/review', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, note: note || '' })
  });
  if (res.ok) loadSubs('');
  else { const d = await res.json(); alert(d.error?.message || '操作失败'); }
}

async function batchAction(action) {
  const note = action === 'reject' ? prompt('统一拒绝原因：') : '';
  if (action === 'reject' && note === null) return;
  const res = await fetch('/api/admin/submissions/batch-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: Array.from(selected), action, note: note || '' })
  });
  if (res.ok) { const d = await res.json(); alert('处理 ' + d.data.processed + ' 条'); loadSubs(''); }
  else { alert('操作失败'); }
}

window.loadSubs = loadSubs;
window.toggleSelect = toggleSelect;
window.reviewSingle = reviewSingle;
window.batchAction = batchAction;
document.querySelectorAll('[data-status-filter]').forEach((button) => {
  button.addEventListener('click', () => loadSubs(button.getAttribute('data-status-filter') || ''));
});
document.getElementById('batch-approve').addEventListener('click', () => batchAction('approve'));
document.getElementById('batch-reject').addEventListener('click', () => batchAction('reject'));
loadSubs('');
      `}} />
    </>
  );
}
