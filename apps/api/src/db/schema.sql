CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'investor',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  hard_cap TEXT NOT NULL,
  soft_cap TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  project_id TEXT UNIQUE NOT NULL,
  token_symbol TEXT NOT NULL,
  token_price TEXT NOT NULL,
  total_supply TEXT NOT NULL,
  raised_amount TEXT NOT NULL,
  state TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL,
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(sale_id) REFERENCES sales(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  contribution_id TEXT,
  user_id TEXT,
  tx_hash TEXT NOT NULL,
  direction TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(contribution_id) REFERENCES contributions(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS wallet_nonces (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL,
  action TEXT NOT NULL,
  consumed_at TEXT NOT NULL,
  UNIQUE(wallet_address, nonce)
);
