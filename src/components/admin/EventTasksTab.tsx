import { useState } from 'react';
import { useEventTasks, TaskStatus, EventTask } from '@/hooks/useEventTasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Download, Edit2, Trash2, Calendar, User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  eventId: string;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Pas commencé',
  in_progress: 'En cours',
  completed: 'Terminé',
  blocked: 'Bloqué',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  blocked: 'bg-red-500',
};

export function EventTasksTab({ eventId }: Props) {
  const {
    tasks,
    loading,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    getTasksByStatus,
    getStats,
    exportToCSV,
  } = useEventTasks(eventId);

  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [editingTask, setEditingTask] = useState<EventTask | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<EventTask>>({
    title: '',
    status: 'not_started',
    owner_label: '',
    stage: '',
    due_date: null,
    notes: '',
  });

  const stats = getStats();
  const tasksByStatus = getTasksByStatus();

  const handleSubmit = async () => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, formData);
        toast.success('Tâche mise à jour');
      } else {
        await createTask(formData);
        toast.success('Tâche ajoutée');
      }
      setShowForm(false);
      setEditingTask(null);
      resetForm();
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (task: EventTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      status: task.status,
      owner_label: task.owner_label || '',
      stage: task.stage || '',
      due_date: task.due_date,
      notes: task.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette tâche ?')) return;
    try {
      await deleteTask(id);
      toast.success('Tâche supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      status: 'not_started',
      owner_label: '',
      stage: '',
      due_date: null,
      notes: '',
    });
  };

  const isOverdue = (task: EventTask) => {
    if (!task.due_date || task.status === 'completed') return false;
    return task.due_date < new Date().toISOString().split('T')[0];
  };

  const TaskCard = ({ task }: { task: EventTask }) => (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        isOverdue(task) && "border-red-500"
      )}
      onClick={() => handleEdit(task)}
    >
      <CardContent className="p-3">
        <div className="flex justify-between items-start gap-2">
          <div className="font-medium text-sm">{task.title}</div>
          {isOverdue(task) && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {task.owner_label && (
            <Badge variant="outline" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              {task.owner_label}
            </Badge>
          )}
          {task.due_date && (
            <Badge variant="outline" className={cn("text-xs", isOverdue(task) && "text-red-500 border-red-500")}>
              <Calendar className="h-3 w-3 mr-1" />
              {new Date(task.due_date).toLocaleDateString('fr-FR')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.notStarted}</div>
            <div className="text-xs text-muted-foreground">À faire</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">En cours</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">Terminé</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.blocked}</div>
            <div className="text-xs text-muted-foreground">Bloqué</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.overdue}</div>
            <div className="text-xs text-muted-foreground">En retard</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-between">
        <Tabs value={view} onValueChange={v => setView(v as 'kanban' | 'list')}>
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="list">Liste</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => { resetForm(); setEditingTask(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['not_started', 'in_progress', 'completed', 'blocked'] as TaskStatus[]).map(status => (
            <div key={status} className="space-y-2">
              <div className="flex items-center gap-2 p-2">
                <div className={cn("w-3 h-3 rounded-full", STATUS_COLORS[status])} />
                <span className="font-medium text-sm">{STATUS_LABELS[status]}</span>
                <Badge variant="secondary" className="ml-auto">{tasksByStatus[status].length}</Badge>
              </div>
              <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-lg p-2">
                {tasksByStatus[status].map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {tasks.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Aucune tâche
                </div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="p-4 flex items-center gap-4">
                    <Select 
                      value={task.status} 
                      onValueChange={(v: TaskStatus) => updateTaskStatus(task.id, v)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1">
                      <div className={cn("font-medium", task.status === 'completed' && "line-through text-muted-foreground")}>
                        {task.title}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {task.owner_label && (
                          <span className="text-xs text-muted-foreground">{task.owner_label}</span>
                        )}
                        {task.due_date && (
                          <span className={cn("text-xs", isOverdue(task) ? "text-red-500" : "text-muted-foreground")}>
                            {new Date(task.due_date).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(task)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(task.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Form Sheet */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTask ? 'Modifier tâche' : 'Nouvelle tâche'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Statut</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v: TaskStatus) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsable</Label>
              <Input
                value={formData.owner_label || ''}
                onChange={e => setFormData({ ...formData, owner_label: e.target.value })}
              />
            </div>
            <div>
              <Label>Étape</Label>
              <Input
                value={formData.stage || ''}
                onChange={e => setFormData({ ...formData, stage: e.target.value })}
              />
            </div>
            <div>
              <Label>Échéance</Label>
              <Input
                type="date"
                value={formData.due_date || ''}
                onChange={e => setFormData({ ...formData, due_date: e.target.value || null })}
              />
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
                {editingTask ? 'Mettre à jour' : 'Ajouter'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
