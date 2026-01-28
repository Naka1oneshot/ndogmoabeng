-- FIX 3: Normalize session_games.status for SHERIFF (and any other inconsistencies)
-- Convert 'Running' (camel-case) to 'RUNNING' (uppercase standard)
UPDATE session_games 
SET status = 'RUNNING' 
WHERE status IN ('Running', 'running');

-- Also normalize any other potential casing issues
UPDATE session_games 
SET status = 'PENDING' 
WHERE status IN ('Pending', 'pending');

UPDATE session_games 
SET status = 'COMPLETED' 
WHERE status IN ('Completed', 'completed');