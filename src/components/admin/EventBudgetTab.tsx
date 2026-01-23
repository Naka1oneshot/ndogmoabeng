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

  const summary = getBudgetSummary();

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

  // Group expenses by type
  const expensesByType = expenses.reduce((acc, exp) => {
    if (!acc[exp.expense_type]) acc[exp.expense_type] = [];
    acc[exp.expense_type].push(exp);
    return acc;
  }, {} as Record<string, EventExpenseItem[]>);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground">Pessimiste</div>
            <div className="text-2xl font-bold text-orange-600">
              {summary.totals.pessimiste.toFixed(0)}€
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground">Probable</div>
            <div className="text-2xl font-bold text-blue-600">
              {summary.totals.probable.toFixed(0)}€
            </div>
          </CardContent>
        </Card>
        <Card>
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

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => setShowSettings(true)} variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Paramètres
        </Button>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button onClick={() => { resetForm(); setEditingExpense(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {/* Expenses by Type */}
      {Object.entries(expensesByType).map(([type, typeExpenses]) => (
        <Card key={type}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex justify-between items-center">
              <span>{type}</span>
              <div className="flex gap-4 text-sm font-normal">
                <span className="text-orange-600">{summary.byType[type]?.pessimiste.toFixed(0)}€</span>
                <span className="text-blue-600">{summary.byType[type]?.probable.toFixed(0)}€</span>
                <span className="text-green-600">{summary.byType[type]?.optimiste.toFixed(0)}€</span>
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
                  <TableHead className="text-right">Pess</TableHead>
                  <TableHead className="text-right">Prob</TableHead>
                  <TableHead className="text-right">Opt</TableHead>
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
                    <TableCell className="text-right">
                      <span className="text-muted-foreground">{expense.qty_pessimiste}</span>
                      <span className="ml-2">{expense.total_pessimiste?.toFixed(0)}€</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground">{expense.qty_probable}</span>
                      <span className="ml-2">{expense.total_probable?.toFixed(0)}€</span>
                    </TableCell>
                    <TableCell className="text-right">
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
      ))}

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
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Paramètres financiers</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
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
            <div>
              <Label>Solde initial (€)</Label>
              <Input
                type="number"
                value={settings?.opening_balance || 0}
                onChange={e => updateSettings({ opening_balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Budget investissement (€)</Label>
              <Input
                type="number"
                value={settings?.investment_budget || 0}
                onChange={e => updateSettings({ investment_budget: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
