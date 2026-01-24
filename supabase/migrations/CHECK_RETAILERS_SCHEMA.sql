-- Check actual retailers table schema
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'retailers'
ORDER BY ordinal_position;
