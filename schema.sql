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

