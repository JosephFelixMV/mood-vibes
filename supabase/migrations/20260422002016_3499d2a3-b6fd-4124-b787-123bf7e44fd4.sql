-- Check existing RLS policies on the routes table
SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'routes'
ORDER BY policyname;