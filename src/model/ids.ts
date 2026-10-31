import type { AccountId, CategoryGroupId, CategoryId, TransactionId } from './types.ts';

const uuid = () => crypto.randomUUID();

export const newTransactionId = () => uuid() as TransactionId;
export const newAccountId = () => uuid() as AccountId;
export const newCategoryId = () => uuid() as CategoryId;
export const newCategoryGroupId = () => uuid() as CategoryGroupId;
