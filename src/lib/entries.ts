/**
 * Entry records for positions opened through ATOMIC. Morpho does not store the price a wallet
 * entered at, so the app remembers it in the browser when a leverage transaction confirms and
 * uses it to show profit since entry on the Positions tab. Best effort: cleared if the user
 * clears site data, and absent for positions opened elsewhere.
 */

export type Entry = {
  marketId: string;
  symbol: string;
  /** stock price paid, USDG per token */
  price: number;
  /** the user's own money that went in, USDG */
  deposit: number;
  /** tokens bought */
  tokens: number;
  /** loan taken, USDG */
  debt: number;
  at: number;
};

const KEY = "atomic-entries-v1";

type Store = Record<string, Record<string, Entry>>; // address -> marketId -> entry

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode or blocked storage: the app still works without the record */
  }
}

export function saveEntry(address: string, entry: Entry) {
  const store = read();
  const a = address.toLowerCase();
  store[a] ??= {};
  const prev = store[a][entry.marketId];
  // Adding to an existing position: blend the entry price by tokens so the P&L stays honest.
  if (prev && prev.tokens > 0) {
    const tokens = prev.tokens + entry.tokens;
    store[a][entry.marketId] = {
      ...entry,
      price: (prev.price * prev.tokens + entry.price * entry.tokens) / tokens,
      deposit: prev.deposit + entry.deposit,
      tokens,
      debt: prev.debt + entry.debt,
      at: prev.at,
    };
  } else {
    store[a][entry.marketId] = entry;
  }
  write(store);
}

export function getEntry(address: string | undefined, marketId: string): Entry | null {
  if (!address) return null;
  return read()[address.toLowerCase()]?.[marketId] ?? null;
}

export function clearEntry(address: string, marketId: string) {
  const store = read();
  const a = address.toLowerCase();
  if (store[a]) {
    delete store[a][marketId];
    write(store);
  }
}
