import { useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EventExpenseItem, BudgetScenario } from '@/hooks/useEventExpenses';

const SCENARIO_LABELS: Record<BudgetScenario, string> = {
  pessimiste: 'Pess.',
  probable: 'Prob.',
  optimiste: 'Opt.',
};

interface Props {
  expense: EventExpenseItem;
  scenarioActive: BudgetScenario;
  onEdit: (expense: EventExpenseItem) => void;
  onDuplicate: (expense: EventExpenseItem) => void;
  onDelete: (id: string) => void;
}

export function BudgetRowCompact({ expense, scenarioActive, onEdit, onDuplicate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get the projected total based on active scenario
  const projectedTotal = scenarioActive === 'pessimiste' 
    ? expense.total_pessimiste 
    : scenarioActive === 'probable' 
      ? expense.total_probable 
      : expense.total_optimiste;

  const projectedQty = scenarioActive === 'pessimiste' 
    ? expense.qty_pessimiste 
    : scenarioActive === 'probable' 
      ? expense.qty_probable 
      : expense.qty_optimiste;

  const hasReal = expense.qty_real != null;
  const ecart = hasReal && projectedTotal != null && expense.total_real != null
    ? projectedTotal - expense.total_real
    : null;

  return (
    <Card className="mb-2">
      <CardContent className="p-3">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{expense.label}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {expense.expense_type}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className="text-muted-foreground">
                {SCENARIO_LABELS[scenarioActive]}: <span className="text-foreground font-medium">{formatCurrency(projectedTotal)}</span>
              </span>
              {hasReal && (
                <>
                  <span className="text-muted-foreground">
                    Réel: <span className="text-foreground font-medium">{formatCurrency(expense.total_real)}</span>
                  </span>
                  {ecart != null && ecart !== 0 && (
                    <span className={cn(
                      "font-medium",
                      ecart > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {ecart > 0 ? '+' : ''}{formatCurrency(ecart)}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 ml-2">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {/* Details */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Prix unitaire:</span>
                <span className="ml-1 font-medium">{formatCurrency(expense.unit_cost)}</span>
              </div>
              {expense.real_unit_cost != null && (
                <div>
                  <span className="text-muted-foreground">PU réel:</span>
                  <span className="ml-1 font-medium">{formatCurrency(expense.real_unit_cost)}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">État:</span>
                <span className="ml-1">{expense.state || '-'}</span>
              </div>
              {expense.order_date && (
                <div>
                  <span className="text-muted-foreground">Commande:</span>
                  <span className="ml-1">{new Date(expense.order_date).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </div>

            {/* Quantities per scenario */}
            <div className="bg-muted/50 rounded p-2">
              <div className="text-xs text-muted-foreground mb-1">Quantités par scénario</div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className={cn(scenarioActive === 'pessimiste' && "font-bold text-orange-600")}>
                  <span className="text-xs text-muted-foreground">Pess.</span>
                  <div>{expense.qty_pessimiste}</div>
                </div>
                <div className={cn(scenarioActive === 'probable' && "font-bold text-blue-600")}>
                  <span className="text-xs text-muted-foreground">Prob.</span>
                  <div>{expense.qty_probable}</div>
                </div>
                <div className={cn(scenarioActive === 'optimiste' && "font-bold text-green-600")}>
                  <span className="text-xs text-muted-foreground">Opt.</span>
                  <div>{expense.qty_optimiste}</div>
                </div>
                <div className="font-medium">
                  <span className="text-xs text-muted-foreground">Réel</span>
                  <div>{expense.qty_real ?? '-'}</div>
                </div>
              </div>
            </div>

            {/* Totals per scenario */}
            <div className="bg-muted/50 rounded p-2">
              <div className="text-xs text-muted-foreground mb-1">Totaux par scénario</div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className={cn(scenarioActive === 'pessimiste' && "font-bold text-orange-600")}>
                  <span className="text-xs text-muted-foreground">Pess.</span>
                  <div>{formatCurrency(expense.total_pessimiste)}</div>
                </div>
                <div className={cn(scenarioActive === 'probable' && "font-bold text-blue-600")}>
                  <span className="text-xs text-muted-foreground">Prob.</span>
                  <div>{formatCurrency(expense.total_probable)}</div>
                </div>
                <div className={cn(scenarioActive === 'optimiste' && "font-bold text-green-600")}>
                  <span className="text-xs text-muted-foreground">Opt.</span>
                  <div>{formatCurrency(expense.total_optimiste)}</div>
                </div>
                <div className="font-medium">
                  <span className="text-xs text-muted-foreground">Réel</span>
                  <div>{formatCurrency(expense.total_real)}</div>
                </div>
              </div>
            </div>

            {expense.notes && (
              <div className="text-sm">
                <span className="text-muted-foreground">Notes:</span>
                <span className="ml-1">{expense.notes}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); onEdit(expense); }}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Modifier cette dépense</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onDuplicate(expense); }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Dupliquer cette dépense</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onDelete(expense.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Supprimer cette dépense</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
