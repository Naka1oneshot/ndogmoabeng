import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEventExpenses, BudgetScenario } from './useEventExpenses';
import { useEventInvites } from './useEventInvites';

export interface PNLRow {
  label: string;
  pessimiste: number;
  probable: number;
  optimiste: number;
  real: number;
  ecart: number;
  isHeader?: boolean;
  isTotal?: boolean;
  indent?: number;
}

export interface PNLData {
  rows: PNLRow[];
  scenarioActive: BudgetScenario;
  summary: {
    revenueReal: number;
    costReal: number;
    profitReal: number;
    revenueProjected: number;
    costProjected: number;
    profitProjected: number;
  };
}

export function useEventPNL(eventId: string | null) {
  const { expenses, settings, getBudgetSummary } = useEventExpenses(eventId);
  const { invites, getStats } = useEventInvites(eventId);
  const [event, setEvent] = useState<{
    expected_players: number;
    price_eur: number;
    pot_potential_eur: number;
  } | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      return;
    }

    async function fetchEvent() {
      const { data } = await supabase
        .from('meetup_events')
        .select('expected_players, price_eur, pot_potential_eur')
        .eq('id', eventId)
        .single();
      
      setEvent(data);
    }

    fetchEvent();
  }, [eventId]);

  const pnlData = useMemo((): PNLData => {
    if (!event) {
      return {
        rows: [],
        scenarioActive: 'probable',
        summary: {
          revenueReal: 0,
          costReal: 0,
          profitReal: 0,
          revenueProjected: 0,
          costProjected: 0,
          profitProjected: 0,
        },
      };
    }

    const scenarioActive = settings?.scenario_active || 'probable';
    const inviteStats = getStats();
    const budgetSummary = getBudgetSummary();

    // Revenue calculations
    const revenueProjected = {
      pessimiste: event.expected_players * event.price_eur * 0.6,
      probable: event.expected_players * event.price_eur * 0.8,
      optimiste: event.expected_players * event.price_eur,
    };

    // Real revenue from invites (avoid double counting)
    const revenueReal = inviteStats.totalRevenue;
    const parkingReal = inviteStats.totalParking;

    // Cost calculations from expenses
    const costs = budgetSummary.totals;

    // Build PNL rows
    const rows: PNLRow[] = [];

    // REVENUS
    rows.push({
      label: 'REVENUS',
      pessimiste: 0,
      probable: 0,
      optimiste: 0,
      real: 0,
      ecart: 0,
      isHeader: true,
    });

    rows.push({
      label: 'Inscriptions',
      pessimiste: revenueProjected.pessimiste,
      probable: revenueProjected.probable,
      optimiste: revenueProjected.optimiste,
      real: revenueReal,
      ecart: revenueProjected[scenarioActive] - revenueReal,
      indent: 1,
    });

    rows.push({
      label: 'Parking',
      pessimiste: 0,
      probable: 0,
      optimiste: 0,
      real: parkingReal,
      ecart: -parkingReal,
      indent: 1,
    });

    const totalRevenuePess = revenueProjected.pessimiste;
    const totalRevenueProb = revenueProjected.probable;
    const totalRevenueOpt = revenueProjected.optimiste;
    const totalRevenueReal = revenueReal + parkingReal;

    rows.push({
      label: 'Total Revenus',
      pessimiste: totalRevenuePess,
      probable: totalRevenueProb,
      optimiste: totalRevenueOpt,
      real: totalRevenueReal,
      ecart: (scenarioActive === 'pessimiste' ? totalRevenuePess : scenarioActive === 'probable' ? totalRevenueProb : totalRevenueOpt) - totalRevenueReal,
      isTotal: true,
    });

    // COÛTS
    rows.push({
      label: 'COÛTS',
      pessimiste: 0,
      probable: 0,
      optimiste: 0,
      real: 0,
      ecart: 0,
      isHeader: true,
    });

    // Costs by type
    Object.entries(budgetSummary.byType).forEach(([type, amounts]) => {
      rows.push({
        label: type,
        pessimiste: amounts.pessimiste,
        probable: amounts.probable,
        optimiste: amounts.optimiste,
        real: amounts.real,
        ecart: (scenarioActive === 'pessimiste' ? amounts.pessimiste : scenarioActive === 'probable' ? amounts.probable : amounts.optimiste) - amounts.real,
        indent: 1,
      });
    });

    rows.push({
      label: 'Total Coûts',
      pessimiste: costs.pessimiste,
      probable: costs.probable,
      optimiste: costs.optimiste,
      real: costs.real,
      ecart: (scenarioActive === 'pessimiste' ? costs.pessimiste : scenarioActive === 'probable' ? costs.probable : costs.optimiste) - costs.real,
      isTotal: true,
    });

    // PROFIT
    rows.push({
      label: 'RÉSULTAT',
      pessimiste: 0,
      probable: 0,
      optimiste: 0,
      real: 0,
      ecart: 0,
      isHeader: true,
    });

    const profitPess = totalRevenuePess - costs.pessimiste;
    const profitProb = totalRevenueProb - costs.probable;
    const profitOpt = totalRevenueOpt - costs.optimiste;
    const profitReal = totalRevenueReal - costs.real;
    const profitProjected = scenarioActive === 'pessimiste' ? profitPess : scenarioActive === 'probable' ? profitProb : profitOpt;

    rows.push({
      label: 'Profit / Perte',
      pessimiste: profitPess,
      probable: profitProb,
      optimiste: profitOpt,
      real: profitReal,
      ecart: profitProjected - profitReal,
      isTotal: true,
    });

    // Opening balance & net
    if (settings?.opening_balance) {
      rows.push({
        label: 'Solde initial',
        pessimiste: settings.opening_balance,
        probable: settings.opening_balance,
        optimiste: settings.opening_balance,
        real: settings.opening_balance,
        ecart: 0,
        indent: 1,
      });

      rows.push({
        label: 'Résultat net',
        pessimiste: profitPess + settings.opening_balance,
        probable: profitProb + settings.opening_balance,
        optimiste: profitOpt + settings.opening_balance,
        real: profitReal + settings.opening_balance,
        ecart: (profitProjected + settings.opening_balance) - (profitReal + settings.opening_balance),
        isTotal: true,
      });
    }

    return {
      rows,
      scenarioActive,
      summary: {
        revenueReal: totalRevenueReal,
        costReal: costs.real,
        profitReal,
        revenueProjected: scenarioActive === 'pessimiste' ? totalRevenuePess : scenarioActive === 'probable' ? totalRevenueProb : totalRevenueOpt,
        costProjected: scenarioActive === 'pessimiste' ? costs.pessimiste : scenarioActive === 'probable' ? costs.probable : costs.optimiste,
        profitProjected,
      },
    };
  }, [event, expenses, settings, invites, getStats, getBudgetSummary]);

  function exportToCSV() {
    if (pnlData.rows.length === 0) return;
    
    const headers = ['', 'Pessimiste', 'Probable', 'Optimiste', 'Réel', 'Écart'];
    const rows = pnlData.rows.map(r => [
      r.label,
      r.pessimiste.toFixed(2),
      r.probable.toFixed(2),
      r.optimiste.toFixed(2),
      r.real.toFixed(2),
      r.ecart.toFixed(2),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pnl-${eventId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    pnlData,
    exportToCSV,
  };
}
