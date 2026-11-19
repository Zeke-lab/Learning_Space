const GUEST_STORAGE_KEY = "ai-book-studio-session";

export function workspaceStorageKey(userId?: string) {
  // Preserve existing guest books. Never silently import them into an account.
  return userId ? `${GUEST_STORAGE_KEY}:user:${encodeURIComponent(userId)}` : GUEST_STORAGE_KEY;
}
