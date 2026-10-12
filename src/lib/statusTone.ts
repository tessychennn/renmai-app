// 狀態的顏色依名稱固定（選項本身沒有顏色欄位，這樣不用改後端）。
// 名稱不在表裡的狀態（自訂的）維持中性的外框樣式。
export type StatusColor = 'gray' | 'green' | 'yellow' | 'red' | 'purple';

const COLOR_BY_NAME: Record<string, StatusColor> = {
  未開始: 'gray',
  進行中: 'green',
  等回覆: 'yellow',
  需聯繫: 'red',
  聯繫中: 'purple',
  // 舊的預設狀態，已經在用的人還看得到
  卡住: 'red',
};

export function statusColor(name: string | undefined): StatusColor | undefined {
  return name ? COLOR_BY_NAME[name] : undefined;
}

/** 巴洛克色系（色票在 index.css）；class 要寫成完整字串，Tailwind 才掃得到 */
export const STATUS_BADGE: Record<StatusColor, string> = {
  gray: 'border-transparent bg-status-gray text-status-gray-ink',
  green: 'border-transparent bg-status-green text-status-green-ink',
  yellow: 'border-transparent bg-status-yellow text-status-yellow-ink',
  red: 'border-transparent bg-status-red text-status-red-ink',
  purple: 'border-transparent bg-status-purple text-status-purple-ink',
};
