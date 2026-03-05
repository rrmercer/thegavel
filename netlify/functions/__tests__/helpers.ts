/**
 * Creates a Proxy that is both thenable (can be awaited) and chainable
 * (any method call returns the same proxy). This simulates Supabase's
 * fluent query-builder pattern without importing the real client.
 *
 * Usage:
 *   mockFrom.mockReturnValueOnce(mockChain({ data: { id: '1' }, error: null }))
 *   // Now supabase.from('x').select(...).eq(...).single() resolves to the value above.
 */
export function mockChain<T>(resolved: T) {
  const promise = Promise.resolve(resolved)
  const handler: ProxyHandler<object> = {
    get(_, prop: string | symbol) {
      if (prop === 'then') return promise.then.bind(promise)
      if (prop === 'catch') return promise.catch.bind(promise)
      if (prop === 'finally') return promise.finally.bind(promise)
      return () => proxy
    },
  }
  const proxy = new Proxy({}, handler)
  return proxy
}

/** Build a minimal Request object for testing Netlify function handlers. */
export function makeRequest(
  method: string,
  url: string,
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
  })
}
