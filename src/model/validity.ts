import type { MissingFields, RequiredField, Transaction } from '../../shared/types';

/** Every visible field except Description is required. */
export const REQUIRED_FIELDS: RequiredField[] = ['accountId', 'occurredAt', 'counterparty', 'amount', 'categoryId'];

export const REQUIRED_LABELS: Record<RequiredField, string> = {
  accountId: 'account',
  occurredAt: 'date',
  counterparty: 'recipient',
  amount: 'amount',
  categoryId: 'category',
};

export function isBlank(v: unknown) {
  return v == null || v === '';
}

export function missingFields(t: Transaction): MissingFields {
  return REQUIRED_FIELDS.filter((f) => isBlank(t[f]));
}

export function isValid(t: Transaction) {
  return REQUIRED_FIELDS.every((f) => !isBlank(t[f]));
}
