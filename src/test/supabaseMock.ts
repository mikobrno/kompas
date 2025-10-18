/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';

type TableName = string;

type Results = {
  select?: any;
  insert?: any;
  update?: any;
  delete?: any;
  single?: any;
  maybeSingle?: any;
};

export type SupabaseFixtures = {
  byTable: Record<TableName, Results>;
  rpc?: Record<string, any>;
};

export type SupabaseSpies = {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  lastInsert: Record<TableName, any>;
  lastUpdate: Record<TableName, any>;
  lastDelete: Record<TableName, any>;
};

class MockQuery {
  private results: Results;
  private spies: SupabaseSpies;
  private table: string;
  private currentResult: any;

  constructor(table: string, results: Results, spies: SupabaseSpies) {
    this.table = table;
    this.results = results;
    this.spies = spies;
    this.currentResult = results.select;
  }

  select() { this.currentResult = this.results.select; return this; }
  eq() { return this; }
  in() { return this; }
  order() { return this; }
  limit() { return this; }
  single() { this.currentResult = this.results.single ?? this.currentResult; return this; }
  maybeSingle() { this.currentResult = this.results.maybeSingle ?? this.currentResult; return this; }

  insert(payload: any) {
    this.spies.lastInsert[this.table] = payload;
    this.currentResult = this.results.insert;
    return this;
  }
  update(payload: any) {
    this.spies.lastUpdate[this.table] = payload;
    this.currentResult = this.results.update;
    return this;
  }
  delete() {
    this.spies.lastDelete[this.table] = true;
    this.currentResult = this.results.delete;
    return this;
  }

  then(resolve: (v: any) => void) {
    resolve({ data: this.currentResult, error: null });
    return Promise.resolve();
  }
}

export function installSupabaseMock(modulePath: string, fixtures: SupabaseFixtures) {
  const spies: SupabaseSpies = {
    from: vi.fn(),
    rpc: vi.fn(),
    lastInsert: {},
    lastUpdate: {},
    lastDelete: {},
  };

  vi.mock(modulePath, () => {
    return {
      supabase: {
        from: (table: string) => {
          spies.from(table);
          const results = fixtures.byTable[table] || {};
          return new MockQuery(table, results, spies);
        },
        rpc: (fn: string, args?: any) => {
          spies.rpc(fn);
          // If fixtures.rpc[fn] is a function, call it with args to allow argument-aware responses
          const val = fixtures.rpc?.[fn];
          const data = typeof val === 'function' ? val(args) : val;
          return Promise.resolve({ data, error: null });
        },
      },
    };
  });

  return spies;
}
