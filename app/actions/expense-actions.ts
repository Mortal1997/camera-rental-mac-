'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseItem } from './expense-shared';

export type ExpenseListResult = {
  expenses: ExpenseItem[];
  total: number;
};

function isExpenseCategory(value: string): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.some((c) => c.value === value);
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function rowToExpense(row: Record<string, unknown>): ExpenseItem {
  const rawCategory = String(row.category ?? 'other');
  return {
    id: String(row.id),
    month: String(row.month),
    category: isExpenseCategory(rawCategory) ? rawCategory : 'other',
    amount: Number(row.amount ?? 0),
    note: (row.note as string | null) ?? null,
    created_at: (row.created_at as string | undefined) ?? undefined,
  };
}

export async function listExpenseItems(options?: {
  startMonth?: string;
  endMonth?: string;
}): Promise<ExpenseItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from('expense_items')
    .select('*')
    .order('month', { ascending: false })
    .order('created_at', { ascending: false });

  if (options?.startMonth) {
    query = query.gte('month', options.startMonth);
  }
  if (options?.endMonth) {
    query = query.lte('month', options.endMonth);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error listing expense items:', error);
    throw new Error('Failed to list expense items');
  }
  return (data ?? []).map(rowToExpense);
}

export async function createExpenseItem(input: {
  month: string;
  category: ExpenseCategory;
  amount: number;
  note?: string;
}): Promise<ExpenseItem> {
  if (!isValidMonth(input.month)) {
    throw new Error('月份格式无效（应为 YYYY-MM）');
  }
  if (!isExpenseCategory(input.category)) {
    throw new Error('未知的成本类目');
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error('金额必须为非负数');
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('未登录');
  }

  const { data, error } = await supabase
    .from('expense_items')
    .insert({
      user_id: userData.user.id,
      month: input.month,
      category: input.category,
      amount: input.amount,
      note: input.note?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating expense item:', error);
    throw new Error('Failed to create expense item');
  }

  revalidatePath('/admin/finance');
  return rowToExpense(data as Record<string, unknown>);
}

export async function deleteExpenseItem(id: string): Promise<void> {
  if (!id) throw new Error('缺少成本记录 ID');
  const supabase = await createClient();
  const { error } = await supabase.from('expense_items').delete().eq('id', id);
  if (error) {
    console.error('Error deleting expense item:', error);
    throw new Error('Failed to delete expense item');
  }
  revalidatePath('/admin/finance');
}
