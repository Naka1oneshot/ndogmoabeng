import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PNLRow, PNLData } from '@/hooks/useEventPNL';
import { BudgetScenario } from '@/hooks/useEventExpenses';

const SCENARIO_LABELS: Record<BudgetScenario, string> = {
  pessimiste: 'Pessimiste',
  probable: 'Probable',
  optimiste: 'Optimiste',
};

interface Props {
  pnlData: PNLData;
}

export function PNLCompactView({ pnlData }: Props) {
  const { rows, scenarioActive, summary } = pnlData;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getProjectedValue = (row: PNLRow) => {
    return scenarioActive === 'pessimiste' 
      ? row.pessimiste 
      : scenarioActive === 'probable' 
        ? row.probable 
        : row.optimiste;
  };

  // Group rows by sections
  const sections: { header: PNLRow; items: PNLRow[]; total?: PNLRow }[] = [];
  let currentSection: { header: PNLRow; items: PNLRow[]; total?: PNLRow } | null = null;

  rows.forEach(row => {
    if (row.isHeader) {
      if (currentSection) sections.push(currentSection);
      currentSection = { header: row, items: [] };
    } else if (row.isTotal && currentSection) {
      currentSection.total = row;
    } else if (currentSection) {
      currentSection.items.push(row);
    }
  });
  if (currentSection) sections.push(currentSection);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Revenus</div>
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(summary.revenueReal)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {SCENARIO_LABELS[scenarioActive]}: {formatCurrency(summary.revenueProjected)}
                </div>
              </div>
              <div className={cn(
                "text-sm font-medium",
                summary.revenueReal >= summary.revenueProjected ? "text-green-600" : "text-red-600"
              )}>
                {summary.revenueReal >= summary.revenueProjected ? '+' : ''}
                {formatCurrency(summary.revenueReal - summary.revenueProjected)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Coûts</div>
                <div className="text-xl font-bold text-red-600">
                  {formatCurrency(summary.costReal)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {SCENARIO_LABELS[scenarioActive]}: {formatCurrency(summary.costProjectedAdjusted)}
                </div>
              </div>
              <div className={cn(
                "text-sm font-medium",
                summary.costReal <= summary.costProjectedAdjusted ? "text-green-600" : "text-red-600"
              )}>
                {summary.costProjectedAdjusted - summary.costReal >= 0 ? '+' : ''}
                {formatCurrency(summary.costProjectedAdjusted - summary.costReal)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          summary.profitReal >= 0 ? "border-green-500/50" : "border-red-500/50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Profit</div>
                <div className={cn(
                  "text-xl font-bold flex items-center gap-2",
                  summary.profitReal >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {summary.profitReal >= 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  {formatCurrency(summary.profitReal)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {SCENARIO_LABELS[scenarioActive]}: {formatCurrency(summary.profitProjectedAdjusted)}
                </div>
              </div>
              <div className={cn(
                "text-sm font-medium",
                summary.profitReal >= summary.profitProjectedAdjusted ? "text-green-600" : "text-red-600"
              )}>
                {summary.profitReal >= summary.profitProjectedAdjusted ? '+' : ''}
                {formatCurrency(summary.profitReal - summary.profitProjectedAdjusted)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Scenario Badge */}
      <div className="text-center text-sm text-muted-foreground">
        Scénario actif: <span className="font-medium text-primary capitalize">{scenarioActive}</span>
      </div>

      {/* Detailed Sections */}
      {sections.map((section, idx) => (
        <Card key={idx}>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-bold">{section.header.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {section.items.map((item, itemIdx) => {
                const projected = getProjectedValue(item);
                return (
                  <div key={itemIdx} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">
                        {formatCurrency(item.real)}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(projected)}
                      </span>
                      {item.ecart !== 0 && (
                        <span className={cn(
                          "text-xs",
                          item.ecart > 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {item.ecart > 0 ? '+' : ''}{formatCurrency(item.ecart)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {section.total && (
                <div className="px-4 py-3 bg-muted/50 flex items-center justify-between font-medium">
                  <span className="text-sm">{section.total.label}</span>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold">
                      {formatCurrency(section.total.real)}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(getProjectedValue(section.total))}
                    </span>
                    {section.total.ecart !== 0 && (
                      <span className={cn(
                        "text-xs font-medium",
                        section.total.ecart > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {section.total.ecart > 0 ? '+' : ''}{formatCurrency(section.total.ecart)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
