import { useState } from 'react';
import { RepeatGuard } from './keys';

export function useRepeatGuard() {
  const [guard] = useState(() => new RepeatGuard());
  return guard;
}
