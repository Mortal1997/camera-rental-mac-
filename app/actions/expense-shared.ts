export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'salary'
  | 'marketing'
  | 'maintenance'
  | 'logistics'
  | 'tax'
  | 'other';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: '房租' },
  { value: 'utilities', label: '水电物业' },
  { value: 'salary', label: '人员工资' },
  { value: 'marketing', label: '营销推广' },
  { value: 'maintenance', label: '设备维护' },
  { value: 'logistics', label: '物流快递' },
  { value: 'tax', label: '税费' },
  { value: 'other', label: '其他' },
];

export type ExpenseItem = {
  id: string;
  month: string; // 'YYYY-MM'
  category: ExpenseCategory;
  amount: number;
  note?: string | null;
  created_at?: string;
};
