import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  eventId: string;
}

interface ImportPreview {
  sheet: string;
  headers: string[];
  rows: string[][];
  mappedData: Record<string, unknown>[];
  errors: string[];
}

const INVITE_COLUMN_MAP: Record<string, string> = {
  'Nom': 'full_name',
  'Prénom': 'full_name', // Will be combined
  'Adresse': 'address',
  'Téléphone': 'phone',
  'Tel': 'phone',
  'Statut': 'invite_status',
  'Pack': 'pack_label',
  'Montant': 'contributed_amount',
  'Parking': 'parking_amount',
  'Notes': 'notes',
  'Invité par': 'invited_by',
  'A envoyer par ?': 'invited_by',
  'Profils': 'profiles',
};

const EXPENSE_COLUMN_MAP: Record<string, string> = {
  'Commande': 'label',
  'Label': 'label',
  'Types': 'expense_type',
  'Type': 'expense_type',
  'État': 'state',
  'Pu Bud': 'unit_cost',
  'PU': 'unit_cost',
  'Qte Bud 1': 'qty_pessimiste',
  'Qté Pess': 'qty_pessimiste',
  'Qte Bud 2': 'qty_probable',
  'Qté Prob': 'qty_probable',
  'Qte Bud 3': 'qty_optimiste',
  'Qté Opt': 'qty_optimiste',
  'Qté Réel': 'qty_real',
  'PU Réel': 'real_unit_cost',
  'Notes': 'notes',
};

const TASK_COLUMN_MAP: Record<string, string> = {
  'Tâche': 'title',
  'Titre': 'title',
  'Statut': 'status',
  'Responsable': 'owner_label',
  'Propriétaire': 'owner_label',
  'Étape': 'stage',
  'Échéance': 'due_date',
  'Date': 'due_date',
  'Notes': 'notes',
};

const STATUS_MAP: Record<string, string> = {
  'Payé': 'paid',
  'Confirmé': 'confirmed_unpaid',
  'En attente': 'pending',
  'Gratuit': 'free',
  'Refusé': 'declined',
  'Pas invité': 'not_invited',
  'À inviter': 'not_invited_yet',
};

const TASK_STATUS_MAP: Record<string, string> = {
  'Pas commencé': 'not_started',
  'En cours': 'in_progress',
  'Terminé': 'completed',
  'Bloqué': 'blocked',
};

export function EventImportTab({ eventId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<ImportPreview[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<Record<string, { success: number; errors: number }>>({});

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      const newPreviews: ImportPreview[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
        
        if (json.length < 2) continue;

        const headers = json[0] as string[];
        const dataRows = json.slice(1, 11); // Preview first 10 rows
        
        let mappedData: Record<string, unknown>[] = [];
        let columnMap: Record<string, string> = {};
        let targetTable = '';

        if (sheetName.toLowerCase().includes('invité') || sheetName.toLowerCase().includes('guest')) {
          columnMap = INVITE_COLUMN_MAP;
          targetTable = 'event_invites';
        } else if (sheetName.toLowerCase().includes('commande') || sheetName.toLowerCase().includes('budget') || sheetName.toLowerCase().includes('expense')) {
          columnMap = EXPENSE_COLUMN_MAP;
          targetTable = 'event_expense_items';
        } else if (sheetName.toLowerCase().includes('tâche') || sheetName.toLowerCase().includes('task')) {
          columnMap = TASK_COLUMN_MAP;
          targetTable = 'event_tasks';
        } else {
          continue; // Skip unknown sheets
        }

        // Map all rows for import
        const allRows = json.slice(1).filter(row => row.some(cell => cell));
        mappedData = allRows.map(row => {
          const obj: Record<string, unknown> = { meetup_event_id: eventId };
          
          headers.forEach((header, idx) => {
            const mappedKey = columnMap[header];
            if (mappedKey && row[idx] !== undefined && row[idx] !== '') {
              let value: unknown = row[idx];
              
              // Handle status mapping
              if (mappedKey === 'invite_status' && typeof value === 'string') {
                value = STATUS_MAP[value] || 'pending';
              }
              if (mappedKey === 'status' && typeof value === 'string') {
                value = TASK_STATUS_MAP[value] || 'not_started';
              }
              
              // Handle numeric fields
              if (['contributed_amount', 'parking_amount', 'unit_cost', 'qty_pessimiste', 'qty_probable', 'qty_optimiste', 'qty_real', 'real_unit_cost'].includes(mappedKey)) {
                value = parseFloat(String(value).replace(',', '.')) || 0;
              }
              
              obj[mappedKey] = value;
            }
          });
          
          return obj;
        });

        newPreviews.push({
          sheet: `${sheetName} → ${targetTable}`,
          headers,
          rows: dataRows,
          mappedData,
          errors: [],
        });
      }

      setPreviews(newPreviews);
      setImportResults({});
    } catch (err) {
      console.error('Error parsing Excel:', err);
      toast.error('Erreur lors de la lecture du fichier');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const results: Record<string, { success: number; errors: number }> = {};

    try {
      for (const preview of previews) {
        const tableName = preview.sheet.split(' → ')[1];
        let success = 0;
        let errors = 0;

        for (const row of preview.mappedData) {
          try {
            // Upsert logic based on table
            if (tableName === 'event_invites') {
              const { error } = await supabase
                .from('event_invites')
                .upsert(row as any, {
                  onConflict: 'meetup_event_id,full_name',
                  ignoreDuplicates: false,
                });
              if (error) throw error;
              success++;
            } else if (tableName === 'event_expense_items') {
              const { error } = await supabase
                .from('event_expense_items')
                .upsert(row as any, {
                  onConflict: 'meetup_event_id,label,expense_type',
                  ignoreDuplicates: false,
                });
              if (error) throw error;
              success++;
            } else if (tableName === 'event_tasks') {
              const { error } = await supabase
                .from('event_tasks')
                .upsert(row as any, {
                  onConflict: 'meetup_event_id,title',
                  ignoreDuplicates: false,
                });
              if (error) throw error;
              success++;
            }
          } catch (err) {
            console.error('Row import error:', err);
            errors++;
          }
        }

        results[tableName] = { success, errors };
      }

      setImportResults(results);
      toast.success('Import terminé');
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Excel
          </CardTitle>
          <CardDescription>
            Importez vos données depuis un fichier Excel. Les feuilles reconnues :
            <ul className="list-disc list-inside mt-2 text-sm">
              <li><strong>Invités</strong> : liste des invités → event_invites</li>
              <li><strong>Commandes / Budget</strong> : dépenses → event_expense_items</li>
              <li><strong>Tâches</strong> : tâches → event_tasks</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full h-32">
            <Upload className="h-8 w-8 mr-4" />
            <span>Cliquez pour sélectionner un fichier Excel</span>
          </Button>
        </CardContent>
      </Card>

      {/* Previews */}
      {previews.map((preview, idx) => (
        <Card key={idx}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{preview.sheet}</span>
              <Badge>{preview.mappedData.length} lignes</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.headers.slice(0, 8).map((h, i) => (
                      <TableHead key={i} className="text-xs">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {row.slice(0, 8).map((cell, j) => (
                        <TableCell key={j} className="text-xs">{String(cell || '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {preview.rows.length > 5 && (
              <div className="text-center text-sm text-muted-foreground mt-2">
                ... et {preview.mappedData.length - 5} autres lignes
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Import Results */}
      {Object.keys(importResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de l'import</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(importResults).map(([table, result]) => (
                <div key={table} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">{table}</span>
                  <div className="flex gap-4">
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {result.success} OK
                    </Badge>
                    {result.errors > 0 && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {result.errors} erreurs
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Button */}
      {previews.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleImport} disabled={importing} size="lg">
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importer les données
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
