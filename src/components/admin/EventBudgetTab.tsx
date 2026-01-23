import { useState } from 'react';
import { useEventExpenses, EventExpenseItem, BudgetScenario } from '@/hooks/useEventExpenses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Download, Edit2, Trash2, Settings, Copy } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { BudgetRowCompact } from './BudgetRowCompact';
import { cn } from '@/lib/utils';

interface Props {
  eventId: string;
}

const SCENARIO_LABELS: Record<BudgetScenario, string> = {
  pessimiste: 'Pessimiste',
  probable: 'Probable',
  optimiste: 'Optimiste',
};

const PREDEFINED_EXPENSE_TYPES = [
  'Lieu',
  'Nourriture',
  'Boissons',
  'Boissons Alcoolisé',
  'Décorations',
  'Couverts et autres utilitaires',
  'Locations',
  'Accessoire',
  'Apéro',
  'Autres',
  'Abonnements',
  'Prestataires',
  'Jeux',
  'Développeur',
  'Frais de déplacement / Livraison',
];

export function EventBudgetTab({ eventId }: Props) {
  const isMobile = useIsMobile();
  const {
    expenses,
    settings,
    loading,
    createExpense,
    updateExpense,
    deleteExpense,
    updateSettings,
    getBudgetSummary,
    exportToCSV,
  } = useEventExpenses(eventId);

  const [editingExpense, setEditingExpense] = useState<EventExpenseItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeValue, setNewTypeValue] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [formData, setFormData] = useState<Partial<EventExpenseItem>>({
    label: '',
    expense_type: '',
    state: '',
    unit_cost: 0,
    qty_pessimiste: 0,
    qty_probable: 0,
    qty_optimiste: 0,
    qty_real: null,
    real_unit_cost: null,
    notes: '',
  });

  // Merge predefined types with custom types from expenses
  const existingCustomTypes = [...new Set(expenses.map(e => e.expense_type))];
  const allExpenseTypes = [...new Set([...PREDEFINED_EXPENSE_TYPES, ...existingCustomTypes])].sort();

  // Get unique states for filter
  const allStates = [...new Set(expenses.map(e => e.state).filter(Boolean))].sort() as string[];

  // Filter expenses
  const filteredExpenses = expenses.filter(exp => {
    const matchType = filterType === 'all' || exp.expense_type === filterType;
    const matchState = filterState === 'all' || exp.state === filterState || (filterState === '__none__' && !exp.state);
    return matchType && matchState;
  });

  const summary = getBudgetSummary();
  const scenarioActive = settings?.scenario_active || 'probable';

  // Get the active scenario total
  const activeScenarioTotal = scenarioActive === 'pessimiste' 
    ? summary.totals.pessimiste 
    : scenarioActive === 'probable' 
      ? summary.totals.probable 
      : summary.totals.optimiste;

  const handleSubmit = async () => {
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, formData);
        toast.success('Dépense mise à jour');
      } else {
        await createExpense(formData);
        toast.success('Dépense ajoutée');
      }
      setShowForm(false);
      setEditingExpense(null);
      resetForm();
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (expense: EventExpenseItem) => {
    setEditingExpense(expense);
    setFormData({
      label: expense.label,
      expense_type: expense.expense_type,
      state: expense.state || '',
      unit_cost: expense.unit_cost,
      qty_pessimiste: expense.qty_pessimiste,
      qty_probable: expense.qty_probable,
      qty_optimiste: expense.qty_optimiste,
      qty_real: expense.qty_real,
      real_unit_cost: expense.real_unit_cost,
      notes: expense.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    try {
      await deleteExpense(id);
      toast.success('Dépense supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDuplicate = (expense: EventExpenseItem) => {
    setEditingExpense(null);
    setFormData({
      label: expense.label + ' (copie)',
      expense_type: expense.expense_type,
      state: expense.state || '',
      unit_cost: expense.unit_cost,
      qty_pessimiste: expense.qty_pessimiste,
      qty_probable: expense.qty_probable,
      qty_optimiste: expense.qty_optimiste,
      qty_real: expense.qty_real,
      real_unit_cost: expense.real_unit_cost,
      notes: expense.notes || '',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      label: '',
      expense_type: '',
      state: '',
      unit_cost: 0,
      qty_pessimiste: 0,
      qty_probable: 0,
      qty_optimiste: 0,
      qty_real: null,
      real_unit_cost: null,
      notes: '',
    });
    setShowNewTypeInput(false);
    setNewTypeValue('');
  };

  const handleTypeChange = (value: string) => {
    if (value === '__NEW__') {
      setShowNewTypeInput(true);
      setFormData({ ...formData, expense_type: '' });
    } else {
      setShowNewTypeInput(false);
      setNewTypeValue('');
      setFormData({ ...formData, expense_type: value });
    }
  };

  const handleNewTypeConfirm = () => {
    if (newTypeValue.trim()) {
      setFormData({ ...formData, expense_type: newTypeValue.trim() });
      setShowNewTypeInput(false);
    }
  };

  // Group filtered expenses by type
  const expensesByType = filteredExpenses.reduce((acc, exp) => {
    if (!acc[exp.expense_type]) acc[exp.expense_type] = [];
    acc[exp.expense_type].push(exp);
    return acc;
  }, {} as Record<string, EventExpenseItem[]>);

  return (
    <div className="space-y-6">
      {/* Summary Cards - Mobile: prioritize active scenario */}
      {isMobile ? (
        <div className="space-y-3">
          {/* Active Scenario - Primary */}
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Scénario actif: <span className="capitalize font-medium text-primary">{scenarioActive}</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {activeScenarioTotal.toFixed(0)}€
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Réel</div>
                  <div className="text-xl font-bold text-primary">
                    {summary.totals.real.toFixed(0)}€
                  </div>
                </div>
              </div>
              <div className={cn(
                "mt-2 text-sm font-medium",
                activeScenarioTotal - summary.totals.real >= 0 ? "text-green-600" : "text-destructive"
              )}>
                Écart: {activeScenarioTotal - summary.totals.real >= 0 ? '+' : ''}{(activeScenarioTotal - summary.totals.real).toFixed(0)}€
              </div>
            </CardContent>
          </Card>
          {/* Other scenarios - Secondary */}
          <div className="grid grid-cols-3 gap-2">
            <Card className={cn(scenarioActive === 'pessimiste' && "opacity-50")}>
              <CardContent className="p-2 text-center">
                <div className="text-xs text-muted-foreground">Pess.</div>
                <div className="text-sm font-bold text-orange-600">
                  {summary.totals.pessimiste.toFixed(0)}€
                </div>
              </CardContent>
            </Card>
            <Card className={cn(scenarioActive === 'probable' && "opacity-50")}>
              <CardContent className="p-2 text-center">
                <div className="text-xs text-muted-foreground">Prob.</div>
                <div className="text-sm font-bold text-blue-600">
                  {summary.totals.probable.toFixed(0)}€
                </div>
              </CardContent>
            </Card>
            <Card className={cn(scenarioActive === 'optimiste' && "opacity-50")}>
              <CardContent className="p-2 text-center">
                <div className="text-xs text-muted-foreground">Opt.</div>
                <div className="text-sm font-bold text-green-600">
                  {summary.totals.optimiste.toFixed(0)}€
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={cn(scenarioActive === 'pessimiste' && "ring-2 ring-primary")}>
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground">Pessimiste</div>
              <div className="text-2xl font-bold text-orange-600">
                {summary.totals.pessimiste.toFixed(0)}€
              </div>
            </CardContent>
          </Card>
          <Card className={cn(scenarioActive === 'probable' && "ring-2 ring-primary")}>
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground">Probable</div>
              <div className="text-2xl font-bold text-blue-600">
                {summary.totals.probable.toFixed(0)}€
              </div>
            </CardContent>
          </Card>
          <Card className={cn(scenarioActive === 'optimiste' && "ring-2 ring-primary")}>
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground">Optimiste</div>
              <div className="text-2xl font-bold text-green-600">
                {summary.totals.optimiste.toFixed(0)}€
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground">Réel</div>
              <div className="text-2xl font-bold text-primary">
                {summary.totals.real.toFixed(0)}€
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex flex-col gap-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Filtrer par type" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">Tous les types</SelectItem>
              {allExpenseTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Filtrer par état" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">Tous les états</SelectItem>
              <SelectItem value="__none__">Sans état</SelectItem>
              {allStates.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterType !== 'all' || filterState !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterType('all'); setFilterState('all'); }}>
              Réinitialiser
            </Button>
          )}
        </div>
        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowSettings(true)} variant="outline" size={isMobile ? "sm" : "default"}>
            <Settings className="h-4 w-4 mr-2" />
            {isMobile ? '' : 'Paramètres'}
          </Button>
          <Button onClick={exportToCSV} variant="outline" size={isMobile ? "sm" : "default"}>
            <Download className="h-4 w-4 mr-2" />
            {isMobile ? '' : 'Export CSV'}
          </Button>
          <Button onClick={() => { resetForm(); setEditingExpense(null); setShowForm(true); }} size={isMobile ? "sm" : "default"}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Expenses by Type */}
      {isMobile ? (
        // Mobile: Compact view grouped by type
        Object.entries(expensesByType).map(([type, typeExpenses]) => (
          <div key={type}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{type}</h3>
              <Badge variant="outline">
                {SCENARIO_LABELS[scenarioActive]}: {summary.byType[type]?.[scenarioActive].toFixed(0)}€
              </Badge>
            </div>
            {typeExpenses.map(expense => (
              <BudgetRowCompact
                key={expense.id}
                expense={expense}
                scenarioActive={scenarioActive}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))
      ) : (
        // Desktop: Table view
        Object.entries(expensesByType).map(([type, typeExpenses]) => (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>{type}</span>
                <div className="flex gap-4 text-sm font-normal">
                  <span className={cn("text-orange-600", scenarioActive === 'pessimiste' && "font-bold underline")}>{summary.byType[type]?.pessimiste.toFixed(0)}€</span>
                  <span className={cn("text-blue-600", scenarioActive === 'probable' && "font-bold underline")}>{summary.byType[type]?.probable.toFixed(0)}€</span>
                  <span className={cn("text-green-600", scenarioActive === 'optimiste' && "font-bold underline")}>{summary.byType[type]?.optimiste.toFixed(0)}€</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="text-right">PU</TableHead>
                    <TableHead className={cn("text-right", scenarioActive === 'pessimiste' && "bg-orange-50 dark:bg-orange-950/20")}>Pess</TableHead>
                    <TableHead className={cn("text-right", scenarioActive === 'probable' && "bg-blue-50 dark:bg-blue-950/20")}>Prob</TableHead>
                    <TableHead className={cn("text-right", scenarioActive === 'optimiste' && "bg-green-50 dark:bg-green-950/20")}>Opt</TableHead>
                    <TableHead className="text-right">Réel</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeExpenses.map(expense => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.label}</TableCell>
                      <TableCell>
                        {expense.state && <Badge variant="outline">{expense.state}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{expense.unit_cost}€</TableCell>
                      <TableCell className={cn("text-right", scenarioActive === 'pessimiste' && "bg-orange-50 dark:bg-orange-950/20")}>
                        <span className="text-muted-foreground">{expense.qty_pessimiste}</span>
                        <span className="ml-2">{expense.total_pessimiste?.toFixed(0)}€</span>
                      </TableCell>
                      <TableCell className={cn("text-right", scenarioActive === 'probable' && "bg-blue-50 dark:bg-blue-950/20")}>
                        <span className="text-muted-foreground">{expense.qty_probable}</span>
                        <span className="ml-2">{expense.total_probable?.toFixed(0)}€</span>
                      </TableCell>
                      <TableCell className={cn("text-right", scenarioActive === 'optimiste' && "bg-green-50 dark:bg-green-950/20")}>
                        <span className="text-muted-foreground">{expense.qty_optimiste}</span>
                        <span className="ml-2">{expense.total_optimiste?.toFixed(0)}€</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {expense.qty_real != null && (
                          <>
                            <span className="text-muted-foreground">{expense.qty_real}</span>
                            <span className="ml-2 font-medium">{expense.total_real?.toFixed(0)}€</span>
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(expense)} title="Modifier">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDuplicate(expense)} title="Dupliquer">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(expense.id)} title="Supprimer">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      {expenses.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune dépense. Importez depuis Excel ou ajoutez manuellement.
          </CardContent>
        </Card>
      )}

      {/* Expense Form Sheet */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingExpense ? 'Modifier dépense' : 'Nouvelle dépense'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Label *</Label>
              <Input
                value={formData.label}
                onChange={e => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            <div>
              <Label>Type *</Label>
              {showNewTypeInput ? (
                <div className="flex gap-2">
                  <Input
                    value={newTypeValue}
                    onChange={e => setNewTypeValue(e.target.value)}
                    placeholder="Nouveau type..."
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={handleNewTypeConfirm}>
                    OK
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => {
                    setShowNewTypeInput(false);
                    setNewTypeValue('');
                  }}>
                    ✕
                  </Button>
                </div>
              ) : formData.expense_type && !allExpenseTypes.includes(formData.expense_type) ? (
                <div className="flex gap-2 items-center">
                  <Badge variant="secondary">{formData.expense_type}</Badge>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setFormData({ ...formData, expense_type: '' })}>
                    Changer
                  </Button>
                </div>
              ) : (
                <Select 
                  value={formData.expense_type || ''} 
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allExpenseTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                    <SelectItem value="__NEW__" className="text-primary font-medium">
                      + Nouveau type...
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>État</Label>
              <Select 
                value={formData.state || ''} 
                onValueChange={v => setFormData({ ...formData, state: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="À commander">À commander</SelectItem>
                  <SelectItem value="Ne pas commander">Ne pas commander</SelectItem>
                  <SelectItem value="Commandé">Commandé</SelectItem>
                  <SelectItem value="Reçu">Reçu</SelectItem>
                  <SelectItem value="Payé">Payé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prix unitaire (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unit_cost || 0}
                onChange={e => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Quantités</Label>
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                className="text-xs h-7"
                onClick={() => setFormData({ 
                  ...formData, 
                  qty_pessimiste: 0, 
                  qty_probable: 0, 
                  qty_optimiste: 0, 
                  qty_real: 0 
                })}
              >
                Tout à 0
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Qté Pessimiste</Label>
                <Input
                  type="number"
                  value={formData.qty_pessimiste || 0}
                  onChange={e => setFormData({ ...formData, qty_pessimiste: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Qté Probable</Label>
                <Input
                  type="number"
                  value={formData.qty_probable || 0}
                  onChange={e => setFormData({ ...formData, qty_probable: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Qté Optimiste</Label>
                <Input
                  type="number"
                  value={formData.qty_optimiste || 0}
                  onChange={e => setFormData({ ...formData, qty_optimiste: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Qté Réelle</Label>
                <Input
                  type="number"
                  value={formData.qty_real ?? ''}
                  onChange={e => setFormData({ ...formData, qty_real: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>PU Réel (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.real_unit_cost ?? ''}
                  onChange={e => setFormData({ ...formData, real_unit_cost: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSubmit} className="flex-1">
                {editingExpense ? 'Mettre à jour' : 'Ajouter'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Paramètres financiers</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 mt-6">
            {/* Scénario actif */}
            <div>
              <Label>Scénario actif</Label>
              <Select 
                value={settings?.scenario_active || 'probable'} 
                onValueChange={(v: BudgetScenario) => updateSettings({ scenario_active: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SCENARIO_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prix unitaires */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Prix unitaires</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prix inscription (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={settings?.inscription_price || 0}
                    onChange={e => updateSettings({ inscription_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Prix parking (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={settings?.parking_price || 0}
                    onChange={e => updateSettings({ parking_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Inscriptions par scénario */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Nb inscriptions prévues</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-orange-600">Pessimiste</Label>
                  <Input
                    type="number"
                    value={settings?.inscriptions_pessimiste || 0}
                    onChange={e => updateSettings({ inscriptions_pessimiste: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-blue-600">Probable</Label>
                  <Input
                    type="number"
                    value={settings?.inscriptions_probable || 0}
                    onChange={e => updateSettings({ inscriptions_probable: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-green-600">Optimiste</Label>
                  <Input
                    type="number"
                    value={settings?.inscriptions_optimiste || 0}
                    onChange={e => updateSettings({ inscriptions_optimiste: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-xs">Réel (laisser vide = auto)</Label>
                <Input
                  type="number"
                  value={settings?.inscriptions_real ?? ''}
                  onChange={e => updateSettings({ inscriptions_real: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Automatique depuis invités payés"
                />
              </div>
            </div>

            {/* Parkings par scénario */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Nb parkings prévus</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-orange-600">Pessimiste</Label>
                  <Input
                    type="number"
                    value={settings?.parking_pessimiste || 0}
                    onChange={e => updateSettings({ parking_pessimiste: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-blue-600">Probable</Label>
                  <Input
                    type="number"
                    value={settings?.parking_probable || 0}
                    onChange={e => updateSettings({ parking_probable: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-green-600">Optimiste</Label>
                  <Input
                    type="number"
                    value={settings?.parking_optimiste || 0}
                    onChange={e => updateSettings({ parking_optimiste: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-xs">Réel (laisser vide = auto)</Label>
                <Input
                  type="number"
                  value={settings?.parking_real ?? ''}
                  onChange={e => updateSettings({ parking_real: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Automatique"
                />
              </div>
            </div>

            {/* Autres paramètres */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Autres</h4>
              <div>
                <Label>Solde initial (€)</Label>
                <Input
                  type="number"
                  value={settings?.opening_balance || 0}
                  onChange={e => updateSettings({ opening_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
