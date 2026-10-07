import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from './parseLegacyJson';

const valid = '{"categories":["業務"],"tasks":[{"id":"a1","name":"寄報價單 \\u003c急\\u003e"}]}';

describe('解析貼上的匯出內容', () => {
  it('正常的 JSON（含試算表腳本用 \\u003c 跳脫的符號）', () => {
    const data = parseLegacyJson(valid) as { tasks: { name: string }[] };
    expect(data.tasks[0].name).toBe('寄報價單 <急>');
  });

  it('前後有空白與換行', () => {
    expect(parseLegacyJson(`\n\n  ${valid}  \n`)).toBeTruthy();
  });

  it('混進隱形字元（BOM、零寬空白）仍可解析', () => {
    expect(parseLegacyJson('﻿' + valid.slice(0, 5) + '​' + valid.slice(5))).toBeTruthy();
  });

  it('前後多了別的文字（例如視窗標題、說明）：只取大括號之間的內容', () => {
    const text = `複製全部內容，貼到 App 的「待辦設定 → 匯入」\n${valid}\n（複製完畢）`;
    expect((parseLegacyJson(text) as { categories: string[] }).categories).toEqual(['業務']);
  });

  it('包在程式碼區塊標記裡', () => {
    expect(parseLegacyJson('```json\n' + valid + '\n```')).toBeTruthy();
  });

  it('空內容：請先貼上或選擇檔案', () => {
    expect(() => parseLegacyJson('   ')).toThrow('沒有內容');
  });

  it('完全不是 JSON：說找不到 {', () => {
    expect(() => parseLegacyJson('hello world')).toThrow('找不到 {');
  });

  it('被截斷（少了結尾）：建議改用選擇檔案', () => {
    const truncated = valid.slice(0, valid.length - 12);
    expect(() => parseLegacyJson(truncated + '}')).toThrow('被截斷');
  });

  it('中間壞掉：指出出錯位置附近的文字，並附技術訊息', () => {
    const broken = '{"categories":["業務"],"tasks":[{"id":"a1","name":"x" "note":"y"}],"members":[]}';
    let message = '';
    try {
      parseLegacyJson(broken);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('無法解析');
    expect(message).toContain('出錯的位置');
    expect(message).toContain('技術訊息');
  });
});
