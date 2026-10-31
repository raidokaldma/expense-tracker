import type { Fetch } from './httpApi';

/** Logs every request with how long it took, so it is easy to see how many requests a user action makes. */
export function withRequestLog(fetchFn: Fetch): Fetch {
  return async (url, init) => {
    const started = performance.now();
    const took = () => `${Math.round(performance.now() - started)} ms`;
    const request = `${init.method} ${url}`;
    const body = typeof init.body === 'string' ? [JSON.parse(init.body)] : [];
    try {
      const res = await fetchFn(url, init);
      if (res.ok) console.info(`${request} · ${took()}`, ...body);
      else console.warn(`${request} · ${res.status} after ${took()}`, ...body);
      return res;
    } catch (err) {
      console.warn(`${request} · failed after ${took()}`, ...body, err);
      throw err;
    }
  };
}
