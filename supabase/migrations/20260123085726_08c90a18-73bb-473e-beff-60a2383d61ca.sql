-- Add unique constraints for Excel upsert operations

-- Unique constraint on event_invites (meetup_event_id, full_name)
ALTER TABLE public.event_invites 
ADD CONSTRAINT event_invites_meetup_event_id_full_name_key 
UNIQUE (meetup_event_id, full_name);

-- Unique constraint on event_expense_items (meetup_event_id, label, expense_type)
ALTER TABLE public.event_expense_items 
ADD CONSTRAINT event_expense_items_meetup_event_id_label_expense_type_key 
UNIQUE (meetup_event_id, label, expense_type);

-- Unique constraint on event_tasks (meetup_event_id, title) for upsert
ALTER TABLE public.event_tasks 
ADD CONSTRAINT event_tasks_meetup_event_id_title_key 
UNIQUE (meetup_event_id, title);