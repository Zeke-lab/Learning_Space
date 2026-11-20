// Server/setup tooling only. No browser database client or public credentials.
export const projectRef = 'wgzfhrtibckrikcppmlq';
export const poolerHost = 'aws-1-ap-southeast-2.pooler.supabase.com';

export function supabaseUrl(role, password, port = 5432) {
  if (!['postgres','learning_space_app','learning_space_authenticator'].includes(role) || !password) {
    throw new Error('Invalid database role or missing password');
  }
  const url = new URL(`postgresql://${poolerHost}:${port}/postgres`);
  url.username = `${role}.${projectRef}`;
  url.password = encodeURIComponent(password);
  return url.toString();
}

export function connectionConfig(value, role) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Database URL is missing or invalid'); }
  if (!['postgres:','postgresql:'].includes(url.protocol) || url.hostname !== poolerHost ||
    !['5432','6543'].includes(url.port) || url.pathname !== '/postgres' || url.hash ||
    decodeURIComponent(url.username) !== `${role}.${projectRef}` || !url.password ||
    [...url.searchParams].some(([key, val]) => key !== 'sslmode' || !['require','verify-full'].includes(val))) {
    throw new Error('Database URL does not match the expected Supabase project and role');
  }
  // Explicit fields prevent URL SSL options from overriding certificate verification.
  return {
    host: url.hostname, port: Number(url.port), database: 'postgres',
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000,
    statement_timeout: 15000, application_name: 'LearningSpace:database-setup',
  };
}
