import type { SQLInputValue, StatementSync } from 'node:sqlite';

// node:sqlite returns null-prototype objects; these spread them into plain ones.

export function allRows<T>(statement: StatementSync, ...params: SQLInputValue[]): T[] {
  return statement.all(...params).map((r) => ({ ...(r as T) }));
}

export function oneRow<T>(statement: StatementSync, ...params: SQLInputValue[]): T | undefined {
  const row = statement.get(...params);
  return row ? { ...(row as T) } : undefined;
}
