import type { MissingFields, RequiredField, Transaction } from './types';

/** Every visible field except Description is required. */
export const REQUIRED_FIELDS: RequiredField[] = ['accountId', 'occurredAt', 'counterparty', 'amount', 'categoryId'];

export const REQUIRED_LABELS: Record<RequiredField, string> = {
  accountId: 'account',
  occurredAt: 'date',
  counterparty: 'recipient',
  amount: 'amount',
  categoryId: 'category',
};

export const isBlank = (v: unknown) => v == null || v === '';

export const missingFields = (t: Transaction): MissingFields => REQUIRED_FIELDS.filter((f) => isBlank(t[f]));

export const isValid = (t: Transaction) => REQUIRED_FIELDS.every((f) => !isBlank(t[f]));
