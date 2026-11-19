-- PostgreSQL 16+. DESIGN FOUNDATION: not connected to the application yet.
-- Apply once with a migration/owner connection, never with a browser credential.
BEGIN;
CREATE SCHEMA learning_space;

CREATE TABLE learning_space.users (
  id text PRIMARY KEY CHECK (id ~ '^google:[A-Za-z0-9_-]{1,255}$'),
  email text NOT NULL CHECK (length(btrim(email)) > 0),
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE learning_space.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES learning_space.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);
CREATE INDEX folders_owner_idx ON learning_space.folders(owner_id);

CREATE TABLE learning_space.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES learning_space.users(id) ON DELETE CASCADE,
  folder_id uuid,
  topic text NOT NULL CHECK (length(btrim(topic)) > 0),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  subtitle text NOT NULL DEFAULT '',
  language_tag text NOT NULL DEFAULT 'my' CHECK (length(btrim(language_tag)) > 0),
  estimated_total_pages integer NOT NULL CHECK (estimated_total_pages BETWEEN 1 AND 2000),
  -- A client-generated UUID makes an explicitly confirmed guest import idempotent.
  import_key uuid,
  archived_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, import_key),
  FOREIGN KEY (owner_id, folder_id) REFERENCES learning_space.folders(owner_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX books_owner_updated_idx ON learning_space.books(owner_id, updated_at DESC, id);
CREATE INDEX books_folder_idx ON learning_space.books(owner_id, folder_id);

CREATE TABLE learning_space.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  book_id uuid NOT NULL,
  chapter_number integer NOT NULL CHECK (chapter_number BETWEEN 1 AND 20),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  estimated_pages integer NOT NULL CHECK (estimated_pages BETWEEN 1 AND 200),
  core_goal text NOT NULL CHECK (length(btrim(core_goal)) > 0),
  sections jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'array' AND jsonb_array_length(sections) BETWEEN 1 AND 12),
  prerequisite_concepts jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(prerequisite_concepts) = 'array' AND jsonb_array_length(prerequisite_concepts) <= 12),
  -- Last accepted output survives a failed regeneration; attempts store transient state.
  markdown text CHECK (markdown IS NULL OR length(btrim(markdown)) > 0),
  content_revision integer NOT NULL DEFAULT 0 CHECK (content_revision >= 0),
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, book_id, id),
  UNIQUE (book_id, chapter_number),
  FOREIGN KEY (owner_id, book_id) REFERENCES learning_space.books(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE learning_space.generation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  book_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  request_key uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  expected_content_revision integer NOT NULL CHECK (expected_content_revision >= 0),
  model text NOT NULL CHECK (length(btrim(model)) > 0),
  prompt_version text NOT NULL CHECK (length(btrim(prompt_version)) > 0),
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, request_key),
  FOREIGN KEY (owner_id, book_id, chapter_id)
    REFERENCES learning_space.chapters(owner_id, book_id, id) ON DELETE CASCADE,
  CHECK ((status IN ('succeeded','failed','cancelled')) = (finished_at IS NOT NULL)),
  CHECK (status <> 'running' OR (started_at IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (finished_at IS NULL OR finished_at >= created_at)
);
CREATE UNIQUE INDEX attempts_one_active_per_chapter ON learning_space.generation_attempts(chapter_id)
  WHERE status IN ('queued','running');
CREATE INDEX attempts_owner_book_idx ON learning_space.generation_attempts(owner_id, book_id, created_at DESC);

CREATE TABLE learning_space.exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  book_id uuid NOT NULL,
  format text NOT NULL CHECK (format IN ('pdf','markdown')),
  book_revision integer NOT NULL CHECK (book_revision > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed','deleting')),
  -- Private object key, never a public URL or stored signed URL.
  object_key text UNIQUE,
  byte_size bigint CHECK (byte_size >= 0),
  sha256 text CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (owner_id, book_id) REFERENCES learning_space.books(owner_id, id) ON DELETE CASCADE,
  CHECK (status <> 'ready' OR (object_key IS NOT NULL AND byte_size IS NOT NULL AND sha256 IS NOT NULL))
);
CREATE INDEX exports_owner_book_idx ON learning_space.exports(owner_id, book_id, created_at DESC);

CREATE FUNCTION learning_space.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- No default access for public/anonymous roles. Provision a non-owner runtime role separately.
REVOKE ALL ON SCHEMA learning_space FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA learning_space FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA learning_space FROM PUBLIC;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','folders','books','chapters','generation_attempts','exports'] LOOP
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON learning_space.%I FOR EACH ROW EXECUTE FUNCTION learning_space.touch_updated_at()', table_name);
    EXECUTE format('ALTER TABLE learning_space.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE learning_space.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY owner_only ON learning_space.%I FOR ALL USING (%I = nullif(current_setting(''app.user_id'', true), '''')) WITH CHECK (%I = nullif(current_setting(''app.user_id'', true), ''''))',
      table_name, CASE WHEN table_name = 'users' THEN 'id' ELSE 'owner_id' END,
      CASE WHEN table_name = 'users' THEN 'id' ELSE 'owner_id' END);
  END LOOP;
END;
$$;
COMMIT;
