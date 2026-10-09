type Filter = { column: string; value: unknown };

/** Shared timeout for /api/data calls so a hung/reset socket can't stall a query forever. */
const DATA_TIMEOUT_MS = 15000;

/** AbortSignal.timeout rejects with TimeoutError (AbortError when cancelled externally). */
function isAbortError(err: unknown): boolean {
  const name = (err as { name?: unknown } | null | undefined)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

/** Parse a response body without throwing; returns null when the body is empty/invalid. */
async function parseJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

class InsertBuilder {
  constructor(
    private table: string,
    private payload: Record<string, unknown> | Record<string, unknown>[],
    private _select?: string,
    private _single = false
  ) {}

  select(columns = "*") {
    this._select = columns;
    return this;
  }

  single() {
    this._single = true;
    return this.execute();
  }

  async execute(): Promise<{ data: unknown; error: { message: string } | null }> {
    let res: Response;
    try {
      res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "insert",
          table: this.table,
          data: this.payload,
          returning: !!this._select,
          single: this._single,
        }),
        signal: AbortSignal.timeout(DATA_TIMEOUT_MS),
      });
    } catch (err) {
      if (isAbortError(err)) throw new Error("Request timed out");
      throw err;
    }
    const json = await parseJson(res);
    if (!res.ok) return { data: null, error: { message: json?.error ?? "Request failed" } };
    if (json == null) return { data: null, error: { message: "Malformed response from server" } };
    return { data: json.data, error: null };
  }

  then<TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class UpdateBuilder {
  private filters: Filter[] = [];

  constructor(private table: string, private payload: Record<string, unknown>) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  async execute(): Promise<{ data: null; error: { message: string } | null; meta?: Record<string, unknown> }> {
    let res: Response;
    try {
      res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "update",
          table: this.table,
          data: this.payload,
          filters: this.filters,
        }),
        signal: AbortSignal.timeout(DATA_TIMEOUT_MS),
      });
    } catch (err) {
      if (isAbortError(err)) throw new Error("Request timed out");
      throw err;
    }
    const json = await parseJson(res);
    if (!res.ok) return { data: null, error: { message: json?.error ?? "Request failed" } };
    if (json == null) return { data: null, error: { message: "Malformed response from server" } };
    return { data: null, error: null, meta: json.meta };
  }

  then<TResult1 = { data: null; error: { message: string } | null; meta?: Record<string, unknown> }, TResult2 = never>(
    onfulfilled?: ((value: { data: null; error: { message: string } | null; meta?: Record<string, unknown> }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class SelectBuilder {
  private filters: Filter[] = [];
  private _order?: { column: string; ascending: boolean };
  private _single = false;
  private _maybeSingle = false;

  constructor(private table: string, private _select = "*") {}

  select(columns: string) {
    this._select = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this._order = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  single() {
    this._single = true;
    return this.execute();
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this.execute();
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    return new InsertBuilder(this.table, data);
  }

  update(data: Record<string, unknown>) {
    return new UpdateBuilder(this.table, data);
  }

  delete() {
    return new DeleteBuilder(this.table);
  }

  async execute(): Promise<{ data: unknown; error: { message: string } | null }> {
    let res: Response;
    try {
      res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "select",
          table: this.table,
          select: this._select,
          filters: this.filters,
          order: this._order,
          single: this._single,
          maybeSingle: this._maybeSingle,
        }),
        signal: AbortSignal.timeout(DATA_TIMEOUT_MS),
      });
    } catch (err) {
      if (isAbortError(err)) throw new Error("Request timed out");
      throw err;
    }
    const json = await parseJson(res);
    if (!res.ok) return { data: null, error: { message: json?.error ?? "Request failed" } };
    if (json == null) return { data: null, error: { message: "Malformed response from server" } };
    return { data: json.data, error: null };
  }

  then<TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class DeleteBuilder {
  private filters: Filter[] = [];

  constructor(private table: string) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  async execute(): Promise<{ data: null; error: { message: string } | null; meta?: Record<string, unknown> }> {
    let res: Response;
    try {
      res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "delete",
          table: this.table,
          filters: this.filters,
        }),
        signal: AbortSignal.timeout(DATA_TIMEOUT_MS),
      });
    } catch (err) {
      if (isAbortError(err)) throw new Error("Request timed out");
      throw err;
    }
    const json = await parseJson(res);
    if (!res.ok) return { data: null, error: { message: json?.error ?? "Request failed" } };
    if (json == null) return { data: null, error: { message: "Malformed response from server" } };
    return { data: null, error: null, meta: json.meta };
  }

  then<TResult1 = { data: null; error: { message: string } | null; meta?: Record<string, unknown> }, TResult2 = never>(
    onfulfilled?: ((value: { data: null; error: { message: string } | null; meta?: Record<string, unknown> }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const db = {
  from(table: string) {
    return new SelectBuilder(table);
  },
};

export const authClient = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: { user: null },
        error: { message: json.error ?? "Login failed", code: json.code as string | undefined },
      };
    }
    return { data: { user: json.user, role: json.role as string | undefined }, error: null };
  },

  async signUp(opts: {
    email: string;
    password: string;
    options?: { data?: { full_name?: string; contact?: string } };
  }) {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: opts.email,
        password: opts.password,
        fullName: opts.options?.data?.full_name,
        contact: opts.options?.data?.contact,
      }),
    });
    const json = await res.json();
    if (!res.ok) return { data: { user: null, session: null }, error: { message: json.error ?? "Signup failed" } };
    return {
      data: {
        user: json.user,
        session: json.session ? { user: json.user } : null,
        needsVerification: Boolean(json.needsVerification),
      },
      error: null,
    };
  },

  async signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  },

  async getSession() {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return { data: { session: null } };
    const json = await res.json();
    return { data: { session: json.session } };
  },

  onAuthStateChange(_cb: (event: string, session: unknown) => void) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};
