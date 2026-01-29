import { useMemo } from 'react';
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
    costProjectedAdjusted: number; // Projected cost adjusted with budget overruns
    profitProjected: number;
    profitProjectedAdjusted: number; // Projected profit adjusted with budget overruns
  };
}

export function useEventPNL(eventId: string | null) {
  const { expenses, settings, getBudgetSummary } = useEventExpenses(eventId);
  const { invites, getStats } = useEventInvites(eventId);

  const pnlData = useMemo((): PNLData => {
    const scenarioActive = settings?.scenario_active || 'probable';
    const inviteStats = getStats();
    const budgetSummary = getBudgetSummary();

    // Revenue calculations from settings
    const inscriptionPrice = settings?.inscription_price || 0;
    const parkingPrice = settings?.parking_price || 0;

    const inscriptionsProjected = {
      pessimiste: settings?.inscriptions_pessimiste || 0,
      probable: settings?.inscriptions_probable || 0,
      optimiste: settings?.inscriptions_optimiste || 0,
    };

    const parkingProjected = {
      pessimiste: settings?.parking_pessimiste || 0,
      probable: settings?.parking_probable || 0,
      optimiste: settings?.parking_optimiste || 0,
    };

    const inscriptionRevenueProjected = {
      pessimiste: inscriptionsProjected.pessimiste * inscriptionPrice,
      probable: inscriptionsProjected.probable * inscriptionPrice,
      optimiste: inscriptionsProjected.optimiste * inscriptionPrice,
    };

    const parkingRevenueProjected = {
      pessimiste: parkingProjected.pessimiste * parkingPrice,
      probable: parkingProjected.probable * parkingPrice,
      optimiste: parkingProjected.optimiste * parkingPrice,
    };

    // Real revenue from settings or invites
    const inscriptionsReal = settings?.inscriptions_real ?? inviteStats.paid;
    const parkingRealQty = settings?.parking_real ?? 0;
    const revenueReal = inscriptionsReal * inscriptionPrice;
    const parkingReal = parkingRealQty * parkingPrice + inviteStats.totalParking;

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
      pessimiste: inscriptionRevenueProjected.pessimiste,
      probable: inscriptionRevenueProjected.probable,
      optimiste: inscriptionRevenueProjected.optimiste,
      real: revenueReal,
      ecart: revenueReal - inscriptionRevenueProjected[scenarioActive],
      indent: 1,
    });

    rows.push({
      label: 'Parking',
      pessimiste: parkingRevenueProjected.pessimiste,
      probable: parkingRevenueProjected.probable,
      optimiste: parkingRevenueProjected.optimiste,
      real: parkingReal,
      ecart: parkingReal - parkingRevenueProjected[scenarioActive],
      indent: 1,
    });

    const totalRevenuePess = inscriptionRevenueProjected.pessimiste + parkingRevenueProjected.pessimiste;
    const totalRevenueProb = inscriptionRevenueProjected.probable + parkingRevenueProjected.probable;
    const totalRevenueOpt = inscriptionRevenueProjected.optimiste + parkingRevenueProjected.optimiste;
    const totalRevenueReal = revenueReal + parkingReal;

    rows.push({
      label: 'Total Revenus',
      pessimiste: totalRevenuePess,
      probable: totalRevenueProb,
      optimiste: totalRevenueOpt,
      real: totalRevenueReal,
      ecart: totalRevenueReal - (scenarioActive === 'pessimiste' ? totalRevenuePess : scenarioActive === 'probable' ? totalRevenueProb : totalRevenueOpt),
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
      ecart: profitReal - profitProjected,
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
        ecart: (profitReal + settings.opening_balance) - (profitProjected + settings.opening_balance),
        isTotal: true,
      });
    }

    // Calculate adjusted projected cost: for each expense type, take max(projected, real)
    // This accounts for budget overruns that have already occurred
    let costProjectedAdjusted = 0;
    Object.entries(budgetSummary.byType).forEach(([_, amounts]) => {
      const projected = scenarioActive === 'pessimiste' ? amounts.pessimiste : scenarioActive === 'probable' ? amounts.probable : amounts.optimiste;
      // If real cost exceeds projected, use real (budget was exceeded)
      // Otherwise use projected (we still expect to pay the projected amount)
      costProjectedAdjusted += Math.max(projected, amounts.real);
    });

    const revenueProjected = scenarioActive === 'pessimiste' ? totalRevenuePess : scenarioActive === 'probable' ? totalRevenueProb : totalRevenueOpt;
    const costProjected = scenarioActive === 'pessimiste' ? costs.pessimiste : scenarioActive === 'probable' ? costs.probable : costs.optimiste;
    const profitProjectedAdjusted = revenueProjected - costProjectedAdjusted;

    return {
      rows,
      scenarioActive,
      summary: {
        revenueReal: totalRevenueReal,
        costReal: costs.real,
        profitReal,
        revenueProjected,
        costProjected,
        costProjectedAdjusted,
        profitProjected,
        profitProjectedAdjusted,
      },
    };
  }, [expenses, settings, invites, getStats, getBudgetSummary]);

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
