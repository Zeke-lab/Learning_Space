BEGIN;
CREATE TABLE learning_space_auth.rate_limits (
  bucket text PRIMARY KEY CHECK (length(bucket) = 64),
  hits integer NOT NULL CHECK (hits > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_expiry_idx ON learning_space_auth.rate_limits(expires_at);
REVOKE ALL ON learning_space_auth.rate_limits FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON learning_space_auth.rate_limits TO learning_space_authenticator;
COMMIT;
