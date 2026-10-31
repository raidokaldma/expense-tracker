import type { Issue } from '../shared/schemas.ts';

export class NotFoundError extends Error {}

export class ConflictError extends Error {}

export class ValidationError extends Error {
  readonly issues: Issue[];
  constructor(issues: Issue[]) {
    super('Invalid request');
    this.issues = issues;
  }
}

export function invalid(path: (string | number)[], message: string) {
  return new ValidationError([{ path, message }]);
}
