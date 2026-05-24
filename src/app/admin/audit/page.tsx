export default function AdminAuditPage() {
  return (
    <>
      <h1 className="text-xl font-bold mb-4">审核日志</h1>
      <div id="audit-list">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `
(async function() {
  const res = await fetch('/api/admin/audit');
  if (res.status === 403) { document.getElementById('audit-list').innerHTML = '<p class="text-red-500">权限不足</p>'; return; }
  const json = await res.json();
  const logs = json.data || [];

  if (!logs.length) {
    document.getElementById('audit-list').innerHTML = '<p class="text-gray-500">暂无审核记录</p>';
    return;
  }

  const actionMap = { approve: '通过', reject: '拒绝', edit: '编辑', remove: '下架', restore: '恢复' };
  const actionColor = { approve: 'text-green-700', reject: 'text-red-700', edit: 'text-blue-700', remove: 'text-orange-700', restore: 'text-purple-700' };

  document.getElementById('audit-list').innerHTML = \`
    <table class="w-full text-sm">
      <thead><tr class="border-b text-left text-gray-500">
        <th class="py-2">时间</th><th>操作</th><th>目标</th><th>操作人</th><th>原因</th>
      </tr></thead>
      <tbody>\${logs.map(l => \`
        <tr class="border-b">
          <td class="py-2 text-xs text-gray-500">\${new Date(l.created_at).toLocaleString('zh-CN')}</td>
          <td class="\${actionColor[l.action] || ''} font-medium">\${actionMap[l.action] || l.action}</td>
          <td class="text-xs text-gray-600">\${l.target_type} / \${l.target_id.slice(0,8)}...</td>
          <td class="text-xs">\${l.reviewer_name || '-'}</td>
          <td class="text-xs text-gray-500">\${l.reason || '-'}</td>
        </tr>
      \`).join('')}</tbody>
    </table>
  \`;
})();
      `}} />
    </>
  );
}
