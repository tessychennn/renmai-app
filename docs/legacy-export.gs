/**
 * 匯出原本「共用待辦清單」試算表的資料，給 App 的「待辦設定 → 匯入」使用。
 * 用法：貼進試算表的 Apps Script，執行 exportJson，複製跳出視窗裡的全部內容。
 * 只讀取，不會改動試算表。
 */
function exportJson() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = ss.getSheetByName('_資料');
  const n = Math.max(data.getLastRow() - 1, 0);
  const rows = n ? data.getRange(2, 1, n, 13).getValues().filter(r => r[0] !== '') : [];
  const toDate = v => v === '' ? null
    : Utilities.formatDate(new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000), 'UTC', 'yyyy-MM-dd');
  const tasks = rows.map(r => ({
    id: r[0], name: r[1], category: r[2], owner: r[3], due: toDate(r[4]),
    priority: r[5], status: r[6], note: r[7], createdBy: r[8], createdAt: String(r[9]),
    done: r[10] === true, doneAt: toDate(r[11]), doneBy: r[12]
  }));
  const set = ss.getSheetByName('設定');
  const m = Math.max(set.getLastRow() - 1, 0);
  const col = c => m ? set.getRange(2, c, m, 1).getValues().map(r => String(r[0]).trim()).filter(Boolean) : [];
  const out = {
    categories: col(1), members: col(3), priorities: col(6), statuses: col(8), tasks: tasks
  };
  const json = JSON.stringify(out).replace(/</g, '\\u003c');
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput('<textarea style="width:100%;height:320px">' + json + '</textarea>')
      .setWidth(560).setHeight(380),
    '複製全部內容，貼到 App 的「待辦設定 → 匯入」');
}
