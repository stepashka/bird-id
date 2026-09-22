CREATE TABLE IF NOT EXISTS identifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  object_key text NOT NULL,
  content_type text NOT NULL,
  common_name text NOT NULL,
  scientific_name text NOT NULL,
  confidence real NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS identifications_user_created_idx
  ON identifications (user_id, created_at DESC);
