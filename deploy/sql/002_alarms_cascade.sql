-- Ensure deleting an asset removes its alarms (idempotent for existing DBs)
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT tc.constraint_name INTO con_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'alarms'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'asset_id'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE alarms DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE alarms
    ADD CONSTRAINT alarms_asset_id_fkey
    FOREIGN KEY (asset_id) REFERENCES assets (asset_id)
    ON UPDATE CASCADE ON DELETE CASCADE;
END $$;
