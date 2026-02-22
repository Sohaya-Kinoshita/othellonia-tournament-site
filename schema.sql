CREATE TABLE
IF NOT EXISTS users
(
  userId TEXT PRIMARY KEY,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL CHECK
(role IN
('admin', 'team')),
  teamId TEXT,
  isLeader INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT
(datetime
('now'))
);

CREATE TABLE
IF NOT EXISTS sessions
(
  sessionId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT
(datetime
('now')),
  FOREIGN KEY
(userId) REFERENCES users
(userId) ON
DELETE CASCADE
);

CREATE INDEX
IF NOT EXISTS idx_sessions_userId ON sessions
(userId);
CREATE INDEX
IF NOT EXISTS idx_sessions_expiresAt ON sessions
(expiresAt);