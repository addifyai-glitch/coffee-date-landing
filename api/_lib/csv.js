/* ==========================================================================
   Generic CSV builder — shared by admin/waitlist.js and admin/invites.js.
   ========================================================================== */

export function toCsv(rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((col) => {
      let val = row[col];
      if (val === null || val === undefined) val = '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','));
  });
  return lines.join('\n');
}
