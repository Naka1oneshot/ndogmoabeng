import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BudgetScenario = 'pessimiste' | 'probable' | 'optimiste';

export interface EventExpenseItem {
  id: string;
  meetup_event_id: string;
  label: string;
  expense_type: string;
  state: string | null;
  order_date: string | null;
  unit_cost: number;
  qty_pessimiste: number;
  qty_probable: number;
  qty_optimiste: number;
  qty_real: number | null;
  real_unit_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  total_pessimiste?: number;
  total_probable?: number;
  total_optimiste?: number;
  total_real?: number;
}

export interface EventFinancialSettings {
  meetup_event_id: string;
  scenario_active: BudgetScenario;
  opening_balance: number;
  investment_budget: number;
}

export interface BudgetSummary {
  byType: Record<string, {
    pessimiste: number;
    probable: number;
    optimiste: number;
    real: number;
  }>;
  totals: {
    pessimiste: number;
    probable: number;
    optimiste: number;
    real: number;
  };
}

export function useEventExpenses(eventId: string | null) {
  const [expenses, setExpenses] = useState<EventExpenseItem[]>([]);
  const [settings, setSettings] = useState<EventFinancialSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setExpenses([]);
      setSettings(null);
      return;
    }

    fetchData(eventId);

    const channel = supabase
      .channel(`expenses-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_expense_items',
          filter: `meetup_event_id=eq.${eventId}`
        },
        () => fetchData(eventId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  async function fetchData(eid: string) {
    try {
      setLoading(true);
      setError(null);

      const [expensesResult, settingsResult] = await Promise.all([
        supabase
          .from('event_expense_items')
          .select('*')
          .eq('meetup_event_id', eid)
          .order('expense_type', { ascending: true })
          .order('label', { ascending: true }),
        supabase
          .from('event_financial_settings')
          .select('*')
          .eq('meetup_event_id', eid)
          .maybeSingle()
      ]);

      if (expensesResult.error) throw expensesResult.error;
      
      // Calculate totals for each expense
      const expensesWithTotals = (expensesResult.data || []).map(exp => ({
        ...exp,
        total_pessimiste: exp.unit_cost * exp.qty_pessimiste,
        total_probable: exp.unit_cost * exp.qty_probable,
        total_optimiste: exp.unit_cost * exp.qty_optimiste,
        total_real: exp.qty_real != null 
          ? (exp.real_unit_cost ?? exp.unit_cost) * exp.qty_real 
          : null,
      }));

      setExpenses(expensesWithTotals);
      setSettings(settingsResult.data as EventFinancialSettings | null);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError('Erreur lors du chargement du budget');
    } finally {
      setLoading(false);
    }
  }

  async function createExpense(expense: Partial<EventExpenseItem>) {
    const { error } = await supabase
      .from('event_expense_items')
      .insert({
        ...expense,
        meetup_event_id: eventId!,
      } as any);
    
    if (error) throw error;
    if (eventId) await fetchData(eventId);
  }

  async function updateExpense(expenseId: string, updates: Partial<EventExpenseItem>) {
    const { error } = await supabase
      .from('event_expense_items')
      .update(updates)
      .eq('id', expenseId);
    
    if (error) throw error;
    if (eventId) await fetchData(eventId);
  }

  async function deleteExpense(expenseId: string) {
    const { error } = await supabase
      .from('event_expense_items')
      .delete()
      .eq('id', expenseId);
    
    if (error) throw error;
    if (eventId) await fetchData(eventId);
  }

  async function updateSettings(updates: Partial<EventFinancialSettings>) {
    if (!eventId) return;

    const { error } = await supabase
      .from('event_financial_settings')
      .upsert({
        meetup_event_id: eventId,
        ...settings,
        ...updates,
      });
    
    if (error) throw error;
    await fetchData(eventId);
  }

  function getBudgetSummary(): BudgetSummary {
    const byType: Record<string, { pessimiste: number; probable: number; optimiste: number; real: number }> = {};
    
    expenses.forEach(exp => {
      if (!byType[exp.expense_type]) {
        byType[exp.expense_type] = { pessimiste: 0, probable: 0, optimiste: 0, real: 0 };
      }
      byType[exp.expense_type].pessimiste += exp.total_pessimiste || 0;
      byType[exp.expense_type].probable += exp.total_probable || 0;
      byType[exp.expense_type].optimiste += exp.total_optimiste || 0;
      byType[exp.expense_type].real += exp.total_real || 0;
    });

    const totals = Object.values(byType).reduce(
      (acc, t) => ({
        pessimiste: acc.pessimiste + t.pessimiste,
        probable: acc.probable + t.probable,
        optimiste: acc.optimiste + t.optimiste,
        real: acc.real + t.real,
      }),
      { pessimiste: 0, probable: 0, optimiste: 0, real: 0 }
    );

    return { byType, totals };
  }

  function exportToCSV() {
    if (expenses.length === 0) return;
    
    const headers = ['Label', 'Type', 'État', 'PU', 'Qté Pess', 'Qté Prob', 'Qté Opt', 'Qté Réel', 'PU Réel', 'Total Pess', 'Total Prob', 'Total Opt', 'Total Réel'];
    const rows = expenses.map(e => [
      e.label,
      e.expense_type,
      e.state || '',
      e.unit_cost.toString(),
      e.qty_pessimiste.toString(),
      e.qty_probable.toString(),
      e.qty_optimiste.toString(),
      e.qty_real?.toString() || '',
      e.real_unit_cost?.toString() || '',
      (e.total_pessimiste || 0).toFixed(2),
      (e.total_probable || 0).toFixed(2),
      (e.total_optimiste || 0).toFixed(2),
      (e.total_real || 0).toFixed(2),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-${eventId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    expenses,
    settings,
    loading,
    error,
    createExpense,
    updateExpense,
    deleteExpense,
    updateSettings,
    getBudgetSummary,
    exportToCSV,
    refetch: () => eventId && fetchData(eventId),
  };
}
