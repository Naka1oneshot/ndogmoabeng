import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export interface EventTask {
  id: string;
  meetup_event_id: string;
  title: string;
  status: TaskStatus;
  owner_label: string | null;
  owner_user_id: string | null;
  stage: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskStats {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  blocked: number;
  overdue: number;
}

export function useEventTasks(eventId: string | null) {
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setTasks([]);
      return;
    }

    fetchTasks(eventId);

    const channel = supabase
      .channel(`tasks-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_tasks',
          filter: `meetup_event_id=eq.${eventId}`
        },
        () => fetchTasks(eventId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  async function fetchTasks(eid: string) {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('event_tasks')
        .select('*')
        .eq('meetup_event_id', eid)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setTasks((data || []) as EventTask[]);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  }

  async function createTask(task: Partial<EventTask>) {
    const { error } = await supabase
      .from('event_tasks')
      .insert({
        ...task,
        meetup_event_id: eventId!,
      } as any);
    
    if (error) throw error;
    if (eventId) await fetchTasks(eventId);
  }

  async function updateTask(taskId: string, updates: Partial<EventTask>) {
    const { error } = await supabase
      .from('event_tasks')
      .update(updates)
      .eq('id', taskId);
    
    if (error) throw error;
    if (eventId) await fetchTasks(eventId);
  }

  async function deleteTask(taskId: string) {
    const { error } = await supabase
      .from('event_tasks')
      .delete()
      .eq('id', taskId);
    
    if (error) throw error;
    if (eventId) await fetchTasks(eventId);
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    await updateTask(taskId, { status });
  }

  function getTasksByStatus(): Record<TaskStatus, EventTask[]> {
    return {
      not_started: tasks.filter(t => t.status === 'not_started'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      completed: tasks.filter(t => t.status === 'completed'),
      blocked: tasks.filter(t => t.status === 'blocked'),
    };
  }

  function getStats(): TaskStats {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: tasks.length,
      notStarted: tasks.filter(t => t.status === 'not_started').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      overdue: tasks.filter(t => 
        t.due_date && 
        t.due_date < today && 
        t.status !== 'completed'
      ).length,
    };
  }

  function exportToCSV() {
    if (tasks.length === 0) return;
    
    const headers = ['Titre', 'Statut', 'Responsable', 'Étape', 'Échéance', 'Notes'];
    const rows = tasks.map(t => [
      t.title,
      t.status,
      t.owner_label || '',
      t.stage || '',
      t.due_date || '',
      (t.notes || '').replace(/,/g, ';'),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks-${eventId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    getTasksByStatus,
    getStats,
    exportToCSV,
    refetch: () => eventId && fetchTasks(eventId),
  };
}
