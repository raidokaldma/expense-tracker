import type { AccountId, CategoryGroupId, CategoryId, TransactionId } from './types.ts';

function uuid() {
  return crypto.randomUUID();
}

export function newTransactionId() {
  return uuid() as TransactionId;
}

export function newAccountId() {
  return uuid() as AccountId;
}

export function newCategoryId() {
  return uuid() as CategoryId;
}

export function newCategoryGroupId() {
  return uuid() as CategoryGroupId;
}
