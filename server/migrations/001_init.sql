-- Timestamps are UTC with whole seconds: 2026-10-20T11:30:00Z. Amounts are integer hundredths.
-- The API validates everything first; these constraints are the last line of defence.

CREATE TABLE accounts (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100 AND name = trim(name)),
  -- the account identifier imports use; NULL for accounts created by hand
  import_key TEXT UNIQUE CHECK (import_key IS NULL OR length(import_key) BETWEEN 1 AND 100)
) STRICT;

-- the API also compares names without case for Estonian letters; NOCASE covers A–Z
CREATE UNIQUE INDEX accounts_name ON accounts (name COLLATE NOCASE);

CREATE TABLE category_groups (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100 AND name = trim(name)),
  -- opening: the starting balance of each account, left out of the overview
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'transfer', 'opening')),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0)
) STRICT;

CREATE UNIQUE INDEX category_groups_name ON category_groups (name COLLATE NOCASE);

-- Saving categories replaces the whole tree in one transaction, so references are checked at commit.
CREATE TABLE categories (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  group_id TEXT NOT NULL REFERENCES category_groups (id) DEFERRABLE INITIALLY DEFERRED,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100 AND name = trim(name)),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0)
) STRICT;

CREATE UNIQUE INDEX categories_name ON categories (name COLLATE NOCASE);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  -- the bank's transaction id; not unique, split rows share their original's
  external_id TEXT CHECK (external_id IS NULL OR length(external_id) BETWEEN 1 AND 200),
  account_id TEXT REFERENCES accounts (id),
  occurred_at TEXT CHECK (
    occurred_at IS NULL OR occurred_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  counterparty TEXT CHECK (counterparty IS NULL OR length(counterparty) BETWEEN 1 AND 200),
  amount INTEGER CHECK (amount IS NULL OR abs(amount) <= 100000000000),
  category_id TEXT REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  description TEXT CHECK (description IS NULL OR length(description) BETWEEN 1 AND 1000),
  added_at TEXT NOT NULL CHECK (
    added_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  ),
  updated_at TEXT NOT NULL CHECK (
    updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  )
) STRICT;

CREATE INDEX transactions_external_id ON transactions (external_id);
CREATE INDEX transactions_account_id ON transactions (account_id);
CREATE INDEX transactions_category_id ON transactions (category_id);

-- one row: the view settings as JSON
CREATE TABLE preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL CHECK (json_valid(value))
) STRICT;
