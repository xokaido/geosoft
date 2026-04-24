-- Per-user login (no self-service registration). Passwords are PBKDF2 hashes (see worker/src/password.ts).
CREATE TABLE IF NOT EXISTS app_users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
