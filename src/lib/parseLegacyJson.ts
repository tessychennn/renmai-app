/**
 * 解析使用者貼上（或選擇檔案）的試算表匯出內容。
 * 先清掉常見的雜質（隱形字元、程式碼區塊標記、前後多餘的文字），失敗時說清楚是哪裡出錯，
 * 而不是只丟一句「不是有效的 JSON」。
 */
export function parseLegacyJson(raw: string): unknown {
  // 隱形字元（BOM、零寬空白）：從網頁或文件複製時偶爾會混進來，肉眼看不到但會讓解析失敗
  let text = raw.replace(/[﻿​-‍⁠]/g, '').trim();
  // 程式碼區塊標記
  text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();

  if (!text) throw new Error('沒有內容，請先貼上或選擇檔案。');

  const start = text.indexOf('{');
  if (start < 0) {
    throw new Error('內容裡找不到 { ，這看起來不是試算表匯出的資料。請確認有複製到完整的文字。');
  }
  const end = text.lastIndexOf('}');
  if (end < start) {
    throw new Error(
      `內容看起來被截斷了（共 ${text.length} 字，結尾不是 }）。請改用「選擇檔案」的方式匯入。`
    );
  }
  // 前後多出來的字（例如視窗標題）直接捨棄，只取 { 到 } 之間
  text = text.slice(start, end + 1);

  try {
    return JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const position = Number(message.match(/position (\d+)/)?.[1]);
    const nearEnd = Number.isFinite(position) && position >= text.length - 20;
    const snippet = Number.isFinite(position)
      ? `出錯的位置在第 ${position + 1} 個字附近：「${text.slice(Math.max(0, position - 15), position + 15)}」。`
      : '';
    throw new Error(
      (nearEnd
        ? `內容看起來被截斷了（共 ${text.length} 字，到結尾前就解析不下去）。請改用「選擇檔案」的方式匯入。`
        : `內容無法解析（共 ${text.length} 字）。${snippet}`) + `（技術訊息：${message}）`
    );
  }
}
