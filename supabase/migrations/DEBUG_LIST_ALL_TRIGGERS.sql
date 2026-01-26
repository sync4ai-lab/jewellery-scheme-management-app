-- List ALL triggers currently on transactions table
SELECT 
  t.tgname AS trigger_name,
  p.proname AS function_name,
  CASE t.tgtype::integer & 1 
    WHEN 1 THEN 'ROW' 
    ELSE 'STATEMENT' 
  END AS trigger_level,
  CASE t.tgtype::integer & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END AS trigger_timing,
  CASE 
    WHEN t.tgtype::integer & 4 = 4 THEN 'INSERT'
    WHEN t.tgtype::integer & 8 = 8 THEN 'DELETE'
    WHEN t.tgtype::integer & 16 = 16 THEN 'UPDATE'
    ELSE 'OTHER'
  END AS trigger_event
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'transactions'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Also show the function source code for each trigger
SELECT 
  t.tgname AS trigger_name,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'transactions'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
