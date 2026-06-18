// =====================================================================
// 闲管家发货回传：快递公司代码表
// ---------------------------------------------------------------------
// 来源：闲管家发货 API 文档（express_code 字段）
// 这张表用于把 UI 里的快递公司中文名映射到闲管家要求的英文 code。
//
// 上线前请在闲管家开放平台"快递公司列表"接口核对一次，如有缺失
// 直接在下面数组里加即可。前端下拉会从这个数组自动渲染。
// =====================================================================

export type ExpressCarrier = {
  code: string;   // 闲管家需要的 express_code
  name: string;   // 中文显示名（同时也作为 express_name 传给闲管家）
};

export const EXPRESS_CARRIERS: readonly ExpressCarrier[] = [
  { code: 'shunfeng',     name: '顺丰速运' },
  { code: 'yuantong',     name: '圆通速递' },
  { code: 'zhongtong',    name: '中通快递' },
  { code: 'shentong',     name: '申通快递' },
  { code: 'yunda',        name: '韵达速递' },
  { code: 'jd',           name: '京东物流' },
  { code: 'jtexpress',    name: '极兔速递' },
  { code: 'youzhengguonei', name: '中国邮政' },
  { code: 'ems',          name: 'EMS' },
  { code: 'debangkuaidi', name: '德邦快递' },
  { code: 'qita',         name: '其他' },
] as const;

// 把 code 反查为 name（找不到就回退到传进来的 code 本身）
export function nameForExpressCode(code: string): string {
  return EXPRESS_CARRIERS.find((c) => c.code === code)?.name ?? code;
}
