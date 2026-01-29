import { useEventPNL } from '@/hooks/useEventPNL';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { PNLCompactView } from './PNLRowCompact';
import { BudgetScenario } from '@/hooks/useEventExpenses';

interface Props {
  eventId: string;
}

const SCENARIO_LABELS: Record<BudgetScenario, string> = {
  pessimiste: 'Pessimiste',
  probable: 'Probable',
  optimiste: 'Optimiste',
};

export function EventPNLTab({ eventId }: Props) {
  const isMobile = useIsMobile();
  const { pnlData, exportToCSV } = useEventPNL(eventId);
  const { scenarioActive } = pnlData;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Mobile view
  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Export Button */}
        <div className="flex justify-end">
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {pnlData.rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucune donnée disponible. Ajoutez des invités et des dépenses.
            </CardContent>
          </Card>
        ) : (
          <PNLCompactView pnlData={pnlData} />
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Revenus (réel)</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(pnlData.summary.revenueReal)}
            </div>
            <div className="text-xs text-muted-foreground">
              {SCENARIO_LABELS[scenarioActive]}: {formatCurrency(pnlData.summary.revenueProjected)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Coûts (réel)</div>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(pnlData.summary.costReal)}
            </div>
            <div className="text-xs text-muted-foreground">
              {SCENARIO_LABELS[scenarioActive]}: {formatCurrency(pnlData.summary.costProjected)}
            </div>
          </CardContent>
        </Card>
        <Card className={cn(
          "col-span-2 md:col-span-1",
          pnlData.summary.profitReal >= 0 ? "border-green-500/50" : "border-destructive/50"
        )}>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Profit (réel)</div>
            <div className={cn(
              "text-2xl font-bold flex items-center gap-2",
              pnlData.summary.profitReal >= 0 ? "text-green-600" : "text-destructive"
            )}>
              {pnlData.summary.profitReal >= 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {formatCurrency(pnlData.summary.profitReal)}
            </div>
            <div className="text-xs text-muted-foreground">
              {SCENARIO_LABELS[scenarioActive]}: {formatCurrency(pnlData.summary.profitProjected)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Scénario actif: <span className="font-medium text-primary capitalize">{scenarioActive}</span>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* PNL Table */}
      <Card>
        <CardHeader>
          <CardTitle>Compte de résultat prévisionnel</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]"></TableHead>
                  <TableHead className={cn("text-right text-orange-600", scenarioActive === 'pessimiste' && "bg-orange-50 dark:bg-orange-950/20 font-bold")}>Pessimiste</TableHead>
                  <TableHead className={cn("text-right text-blue-600", scenarioActive === 'probable' && "bg-blue-50 dark:bg-blue-950/20 font-bold")}>Probable</TableHead>
                  <TableHead className={cn("text-right text-green-600", scenarioActive === 'optimiste' && "bg-green-50 dark:bg-green-950/20 font-bold")}>Optimiste</TableHead>
                  <TableHead className="text-right font-bold">Réel</TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pnlData.rows.map((row, idx) => (
                  <TableRow 
                    key={idx}
                    className={cn(
                      row.isHeader && "bg-muted/50 font-bold",
                      row.isTotal && "font-semibold border-t-2"
                    )}
                  >
                    <TableCell className={cn(row.indent && `pl-${row.indent * 4 + 4}`)}>
                      {row.indent ? (
                        <span className="text-muted-foreground">• </span>
                      ) : null}
                      {row.label}
                    </TableCell>
                    <TableCell className={cn("text-right", scenarioActive === 'pessimiste' && "bg-orange-50 dark:bg-orange-950/20")}>
                      {!row.isHeader && formatCurrency(row.pessimiste)}
                    </TableCell>
                    <TableCell className={cn("text-right", scenarioActive === 'probable' && "bg-blue-50 dark:bg-blue-950/20")}>
                      {!row.isHeader && formatCurrency(row.probable)}
                    </TableCell>
                    <TableCell className={cn("text-right", scenarioActive === 'optimiste' && "bg-green-50 dark:bg-green-950/20")}>
                      {!row.isHeader && formatCurrency(row.optimiste)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {!row.isHeader && (
                        row.indent ? (
                          <span>
                            {formatCurrency(row.real)}
                            <span className="text-muted-foreground font-normal"> / </span>
                            <span className="text-muted-foreground font-normal">
                              {formatCurrency(
                                scenarioActive === 'pessimiste' ? row.pessimiste :
                                scenarioActive === 'probable' ? row.probable : row.optimiste
                              )}
                            </span>
                          </span>
                        ) : formatCurrency(row.real)
                      )}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right",
                      row.ecart > 0 ? "text-green-600" : row.ecart < 0 ? "text-destructive" : ""
                    )}>
                      {!row.isHeader && row.ecart !== 0 && (
                        <>
                          {row.ecart > 0 ? '+' : ''}{formatCurrency(row.ecart)}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {pnlData.rows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune donnée disponible. Ajoutez des invités et des dépenses.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
