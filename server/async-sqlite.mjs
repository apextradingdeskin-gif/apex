import { AsyncLocalStorage } from 'node:async_hooks';

// Async request handlers must not interleave statements inside another SQLite transaction.
export function asyncSqlite(raw) {
  const scope = new AsyncLocalStorage();
  let tail = Promise.resolve();
  const exclusive = (operation) => {
    const result = tail.then(operation, operation);
    tail = result.catch(() => {});
    return result;
  };
  const execute = (operation) => scope.getStore() ? Promise.resolve().then(operation) : exclusive(operation);
  return {
    prepare(sql) {
      const statement = raw.prepare(sql);
      return {
        all: (...args) => execute(() => statement.all(...args)),
        get: (...args) => execute(() => statement.get(...args)),
        run: (...args) => execute(() => statement.run(...args)),
      };
    },
    transaction(callback) {
      return async (...args) => {
        if (scope.getStore()) return callback(...args);
        return exclusive(() => scope.run(true, async () => {
          raw.exec('BEGIN IMMEDIATE');
          try { const result = await callback(...args); raw.exec('COMMIT'); return result; }
          catch (error) { raw.exec('ROLLBACK'); throw error; }
        }));
      };
    },
    close: () => raw.close(),
  };
}