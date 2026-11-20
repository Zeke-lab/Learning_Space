-- Account foundation only. Apply AFTER 001 with the migration owner connection.
-- Converts legacy Google account IDs while retaining books and all ownership links.
-- Authentication tables intentionally receive no book-runtime or PUBLIC grants.
BEGIN;

-- Take all locks before conversion; block writes until the transaction commits.
LOCK TABLE learning_space.users, learning_space.folders, learning_space.books,
  learning_space.chapters, learning_space.generation_attempts, learning_space.exports
  IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE item record; table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','folders','books','chapters','generation_attempts','exports'] LOOP
    EXECUTE format('ALTER TABLE learning_space.%I DISABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY owner_only ON learning_space.%I', table_name);
  END LOOP;
  FOR item IN
    SELECT c.conname, t.relname FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'learning_space' AND c.contype = 'f'
      AND t.relname IN ('folders','books','chapters','generation_attempts','exports')
  LOOP
    EXECUTE format('ALTER TABLE learning_space.%I DROP CONSTRAINT %I', item.relname, item.conname);
  END LOOP;
END;
$$;

CREATE TEMP TABLE account_id_map ON COMMIT DROP AS
  SELECT id AS legacy_id, gen_random_uuid() AS account_id FROM learning_space.users;
ALTER TABLE account_id_map ADD PRIMARY KEY (legacy_id), ADD UNIQUE (account_id);

ALTER TABLE learning_space.users DROP CONSTRAINT users_id_check;
UPDATE learning_space.users u SET id = m.account_id::text
  FROM account_id_map m WHERE u.id = m.legacy_id;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['folders','books','chapters','generation_attempts','exports'] LOOP
    EXECUTE format('UPDATE learning_space.%I t SET owner_id = m.account_id::text FROM account_id_map m WHERE t.owner_id = m.legacy_id', table_name);
    EXECUTE format('ALTER TABLE learning_space.%I ALTER COLUMN owner_id TYPE uuid USING owner_id::uuid', table_name);
  END LOOP;
END;
$$;

ALTER TABLE learning_space.users
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN email_verified_at timestamptz,
  ADD COLUMN session_version integer NOT NULL DEFAULT 1 CHECK (session_version > 0),
  ADD COLUMN disabled_at timestamptz;

ALTER TABLE learning_space.folders ADD FOREIGN KEY (owner_id)
  REFERENCES learning_space.users(id) ON DELETE CASCADE;
ALTER TABLE learning_space.books ADD FOREIGN KEY (owner_id)
  REFERENCES learning_space.users(id) ON DELETE CASCADE;
ALTER TABLE learning_space.books ADD FOREIGN KEY (owner_id, folder_id)
  REFERENCES learning_space.folders(owner_id, id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE learning_space.chapters ADD FOREIGN KEY (owner_id, book_id)
  REFERENCES learning_space.books(owner_id, id) ON DELETE CASCADE;
ALTER TABLE learning_space.generation_attempts ADD FOREIGN KEY (owner_id, book_id, chapter_id)
  REFERENCES learning_space.chapters(owner_id, book_id, id) ON DELETE CASCADE;
ALTER TABLE learning_space.exports ADD FOREIGN KEY (owner_id, book_id)
  REFERENCES learning_space.books(owner_id, id) ON DELETE CASCADE;

CREATE SCHEMA learning_space_auth;
REVOKE ALL ON SCHEMA learning_space_auth FROM PUBLIC;

CREATE TABLE learning_space_auth.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES learning_space.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'google'),
  provider_subject text NOT NULL CHECK (provider_subject ~ '^[A-Za-z0-9_-]{1,255}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);
CREATE INDEX identities_user_idx ON learning_space_auth.identities(user_id);
INSERT INTO learning_space_auth.identities(user_id, provider, provider_subject)
  SELECT account_id, 'google', substring(legacy_id FROM 8) FROM account_id_map;
-- Migration cannot prove an email's verification history; the verified login
-- integration must set email_verified_at using a fresh trusted provider result.

-- Optional foundation for email/password registration. No registration UI or
-- password flow is activated by creating this table. Google users need no row.
CREATE TABLE learning_space_auth.password_credentials (
  user_id uuid PRIMARY KEY REFERENCES learning_space.users(id) ON DELETE CASCADE,
  login_email text NOT NULL UNIQUE CHECK (
    login_email = lower(btrim(login_email)) AND length(login_email) BETWEEN 3 AND 320
    AND position('@' IN login_email) > 1),
  password_hash text NOT NULL CHECK (
    length(password_hash) BETWEEN 40 AND 1024 AND password_hash LIKE '$argon2id$%'),
  email_verified_at timestamptz,
  credential_revision integer NOT NULL DEFAULT 1 CHECK (credential_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE learning_space_auth.email_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES learning_space_auth.password_credentials(user_id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  token_digest text NOT NULL UNIQUE CHECK (token_digest ~ '^[a-f0-9]{64}$'),
  -- Bind the challenge to the email and credential revision at issuance.
  login_email text NOT NULL CHECK (
    login_email = lower(btrim(login_email)) AND length(login_email) BETWEEN 3 AND 320
    AND position('@' IN login_email) > 1),
  credential_revision integer NOT NULL CHECK (credential_revision > 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '24 hours'),
  CHECK (consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at < expires_at))
);
CREATE INDEX challenges_user_idx ON learning_space_auth.email_challenges(user_id, purpose);
CREATE INDEX challenges_expiry_idx ON learning_space_auth.email_challenges(expires_at);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','folders','books','chapters','generation_attempts','exports'] LOOP
    EXECUTE format(
      'CREATE POLICY owner_only ON learning_space.%I FOR ALL USING (%I::text = nullif(current_setting(''app.user_id'', true), '''')) WITH CHECK (%I::text = nullif(current_setting(''app.user_id'', true), ''''))',
      table_name, CASE WHEN table_name = 'users' THEN 'id' ELSE 'owner_id' END,
      CASE WHEN table_name = 'users' THEN 'id' ELSE 'owner_id' END);
    EXECUTE format('ALTER TABLE learning_space.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE learning_space.%I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['identities','password_credentials'] LOOP
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON learning_space_auth.%I FOR EACH ROW EXECUTE FUNCTION learning_space.touch_updated_at()', table_name);
  END LOOP;
END;
$$;
REVOKE ALL ON ALL TABLES IN SCHEMA learning_space_auth FROM PUBLIC;
COMMIT;
