import { describe, expect, it } from "vitest";

import {
  extendNamespace,
  hydrate,
  MountError,
  ownedBy,
  type NamespaceHost,
  type Namespaces,
  type Owned,
} from "./namespace.ts";
import { Provider, type Extension } from "./types.ts";

/** The common keystore API every surface of the `key` domain exposes. */
interface KeyStoreAPI {
  label: string;
  /** Looks the key up by id and forwards to the operation its owner hydrated. */
  sign(id: string, bytes: Uint8Array): string;
}

/** A hardware device's surface: the common API plus what only this party needs. */
interface DeviceAPI extends KeyStoreAPI {
  connect(): void;
  calls: string[];
  /** How many times the device's hydration ran (test instrumentation). */
  runs?(): number;
}

/** The `key` namespace the fixtures register: the local store plus hardware surfaces. */
interface KeyNamespace {
  store?: KeyStoreAPI;
  hardware?: { ledger?: DeviceAPI; trezor?: DeviceAPI };
}

/** The `account` namespace a two-domain fixture also extends. */
interface AccountNamespace {
  store?: KeyStoreAPI;
}

// Register the options slices and the namespaces these fixtures claim on the
// real registries, as an extension package would. Unregistered slices and
// namespaces are compile errors (see `tsconfig.test.json` / `pnpm test:types`).
declare module "./index.js" {
  interface ExtensionOptions {
    /** Keys slice: `WithKeys` → `options.keys.store` → `provider.key`. */
    keys?: { store?: KeyListStore };
  }
  interface Namespaces {
    key: KeyNamespace;
    account: AccountNamespace;
  }
}

/** A stand-in keystore API: an object with methods is a mounted surface. */
function keystore(label: string): KeyStoreAPI {
  return { label, sign: (id, bytes) => `${label}:${id}:${bytes.length}` };
}

/** A stand-in hardware device surface. */
function device(label: string): DeviceAPI {
  return { ...keystore(label), connect() {}, calls: [] };
}

/** The package names the fixtures write under: every entry carries its writer's name. */
const LOCAL = "@test/keystore-local";
const VAULT = "@test/keystore-vault";
const LEDGER = "@test/keystore-ledger";
const TREZOR = "@test/keystore-trezor";

/** An entry of the domain's single key list, tagged with the package that owns it. */
interface KeyEntry extends Owned {
  id: string;
  /** Attached by the owner's hydration; absent until then. */
  sign?: (bytes: Uint8Array) => string;
}

/** A minimal reactive store: the one list every surface of the domain writes into. */
class KeyListStore {
  state: { keys: KeyEntry[] } = { keys: [] };
  private listeners = new Set<(state: { keys: KeyEntry[] }) => void>();
  add(entry: KeyEntry) {
    this.setState({ keys: [...this.state.keys, entry] });
  }
  /** Replaces the whole list, as a bridge does when it reconciles a snapshot. */
  setState(state: { keys: KeyEntry[] }) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
  subscribe(listener: (state: { keys: KeyEntry[] }) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
}

/** A provider mid-construction: the core with the given namespaces already mounted. */
function host(namespaces: Partial<Namespaces> = {}): NamespaceHost {
  return Object.assign(new Provider({ id: "p1", name: "Wallet" }), namespaces);
}

describe("Namespaces registry", () => {
  it("only accepts registered namespace names", () => {
    const provider = host({ key: { store: keystore("local") } });

    expect(extendNamespace(provider, "account", {})).toEqual({ account: {} });
    // @ts-expect-error `keys` is not a registered namespace.
    expect(extendNamespace(provider, "keys", {})).toEqual({ keys: {} });
  });

  it("types provider.<namespace> and options.<domain> on every Extension", () => {
    const local = keystore("local");
    const store = new KeyListStore();
    const seen: unknown[] = [];

    const WithLocal = ((provider) =>
      extendNamespace(provider, "key", { store: local })) satisfies Extension;
    const Probe = ((provider, options) => {
      // No cast, no annotation: `Extension` types both parameters from the registries.
      seen.push(provider.key?.store?.label, provider.account?.store, options.keys?.store);
      // @ts-expect-error `keys` is not a registered namespace.
      seen.push(provider.keys);
      // @ts-expect-error `keystores` is not a registered options slice.
      seen.push(options.keystores);
      return {};
    }) satisfies Extension;

    const Composed = Provider.withExtensions([WithLocal, Probe]);
    new Composed({ id: "p1", name: "Wallet" }, { keys: { store } });

    expect(seen).toEqual(["local", undefined, store, undefined, undefined]);
  });
});

describe("extendNamespace", () => {
  it("mounts a surface on a fresh namespace", () => {
    const local = keystore("local");

    expect(extendNamespace(host(), "key", { store: local })).toEqual({ key: { store: local } });
    expect(extendNamespace(host(), "key", { store: local }).key.store).toBe(local);
  });

  it("merges a branch beside an existing leaf without mutating the original", () => {
    const local = keystore("local");
    const ledger = device("ledger");
    const provider = host({ key: { store: local } });

    const { key } = extendNamespace(provider, "key", { hardware: { ledger } });

    expect(key).toEqual({ store: local, hardware: { ledger } });
    expect(key.store).toBe(local);
    expect(key).not.toBe(provider.key);
    expect(provider.key).toEqual({ store: local });
  });

  it("merges into an existing group, copying along the path", () => {
    const ledger = device("ledger");
    const trezor = device("trezor");
    const provider = host({ key: { store: keystore("local"), hardware: { ledger } } });

    const { key } = extendNamespace(provider, "key", { hardware: { trezor } });

    expect(key.hardware).toEqual({ ledger, trezor });
    expect(key.hardware).not.toBe(provider.key?.hardware);
    expect(provider.key?.hardware).toEqual({ ledger });
  });

  it("refuses to take a name that is already mounted", () => {
    const provider = host({ key: { store: keystore("local") } });

    expect(() => extendNamespace(provider, "key", { store: keystore("other") })).toThrow(
      /^key\.store is already mounted on this provider$/,
    );
    expect(() => extendNamespace(provider, "key", { store: keystore("other") })).toThrow(
      MountError,
    );
  });

  it("refuses to descend into a mounted surface", () => {
    const provider = host({ key: { store: keystore("local") } });

    expect(() =>
      // @ts-expect-error `nested` is not part of the registered `key.store` surface.
      extendNamespace(provider, "key", { store: { nested: keystore("ledger") } }),
    ).toThrow(/^key\.store is a mounted surface, not a namespace$/);
  });

  it("refuses to replace a group with a leaf", () => {
    const provider = host({ key: { hardware: { ledger: device("ledger") } } });

    expect(() =>
      // @ts-expect-error a surface is not a `key.hardware` group.
      extendNamespace(provider, "key", { hardware: keystore("trezor") }),
    ).toThrow(/^key\.hardware is already mounted on this provider$/);
  });

  it("treats class instances and objects with methods as leaves", () => {
    // @ts-expect-error a `KeyListStore` is not a `KeyStoreAPI`; the runtime still sees a leaf.
    const provider = host({ key: { store: new KeyListStore() } });

    // @ts-expect-error `nested` is not part of the registered `key.store` surface.
    expect(() => extendNamespace(provider, "key", { store: { nested: {} } })).toThrow(MountError);
    // @ts-expect-error a `KeyListStore` is not a `KeyStoreAPI`.
    expect(() => extendNamespace(provider, "key", { store: new KeyListStore() })).toThrow(
      MountError,
    );
    expect(() =>
      extendNamespace(host({ key: { hardware: { ledger: device("ledger") } } }), "key", {
        hardware: { ledger: { connect: () => {} } },
      }),
    ).toThrow(/^key\.hardware\.ledger is already mounted/);
  });

  it("tolerates a non-object existing value and skips undefined branches", () => {
    const local = keystore("local");

    expect(extendNamespace(host({ key: undefined }), "key", { store: local })).toEqual({
      key: { store: local },
    });
    // @ts-expect-error a string is not a namespace group; the runtime treats it as empty.
    expect(extendNamespace(host({ key: "junk" }), "key", { store: local })).toEqual({
      key: { store: local },
    });
    expect(
      // @ts-expect-error `null` is not a namespace group; the runtime treats it as empty.
      extendNamespace(host({ key: null }), "key", { store: local, hardware: undefined }),
    ).toEqual({ key: { store: local } });
  });

  it("spreads into an extension that also adds getters", () => {
    const store = new KeyListStore();
    store.add({ id: "k1", owner: LOCAL });
    const local = keystore("local");
    const provider = host({ key: { hardware: { ledger: device("ledger") } } });

    const surface = {
      ...extendNamespace(provider, "key", { store: local }),
      get keys() {
        return store.state.keys;
      },
    };

    expect(surface.key.store).toBe(local);
    expect(surface.key.hardware?.ledger?.label).toBe("ledger");
    expect(surface.keys.map((k) => k.id)).toEqual(["k1"]);
  });
});

describe("composition on a real Provider", () => {
  it("lets several extensions share one namespace", () => {
    const local = keystore("local");
    const ledger = device("ledger");
    const trezor = device("trezor");

    const WithLocal = ((provider) =>
      extendNamespace(provider, "key", { store: local })) satisfies Extension;
    const WithLedger = ((provider) =>
      extendNamespace(provider, "key", { hardware: { ledger } })) satisfies Extension;
    const WithTrezor = ((provider) =>
      extendNamespace(provider, "key", { hardware: { trezor } })) satisfies Extension;

    const Composed = Provider.withExtensions([WithLocal, WithLedger, WithTrezor]);
    const provider = new Composed({ id: "p1", name: "Wallet" });

    // The composed instance exposes `key` typed from the extensions' return types.
    const { key } = provider;
    expect(key.store).toBe(local);
    expect(key.hardware?.ledger).toBe(ledger);
    expect(key.hardware?.trezor).toBe(trezor);
    expect(Object.keys(key)).toEqual(["store", "hardware"]);
  });

  it("lets a key management service replace the local keystore at store", () => {
    // A wallet backed by HashiCorp Vault has no local keystore: the Vault
    // surface is `key.store`, and hardware surfaces sit beside it.
    const vault = { ...keystore("vault"), login: () => {} };
    const ledger = device("ledger");

    const WithVault = ((provider) =>
      extendNamespace(provider, "key", { store: vault })) satisfies Extension;
    const WithLedger = ((provider) =>
      extendNamespace(provider, "key", { hardware: { ledger } })) satisfies Extension;

    const Composed = Provider.withExtensions([WithVault, WithLedger]);
    const provider = new Composed({ id: "p1", name: "Wallet" });

    const { key } = provider;
    expect(key.store).toBe(vault);
    expect(key.store).toHaveProperty("login");
    expect(key.hardware?.ledger).toBe(ledger);
  });

  it("lets a dependent extension read its dependency while being built", () => {
    const ledger = device("ledger");
    const seen: string[] = [];

    const WithLedger = ((provider) =>
      extendNamespace(provider, "key", { hardware: { ledger } })) satisfies Extension;
    const WithAccountsBridge = ((provider) => {
      // `provider.key` is `Namespaces["key"] | undefined`: the probe is a plain read.
      const device = provider.key?.hardware?.ledger;
      if (!device) {
        throw new Error("WithAccountsBridge requires a Ledger at provider.key.hardware.ledger");
      }
      seen.push(device.label);
      return {};
    }) satisfies Extension;

    const Composed = Provider.withExtensions([WithLedger, WithAccountsBridge]);
    new Composed({ id: "p1", name: "Wallet" });
    expect(seen).toEqual(["ledger"]);

    const Reversed = Provider.withExtensions([WithAccountsBridge, WithLedger]);
    expect(() => new Reversed({ id: "p1", name: "Wallet" })).toThrow(
      /requires a Ledger at provider\.key\.hardware\.ledger/,
    );
  });

  it("lets one extension extend two namespaces in a single return", () => {
    const local = keystore("local");
    const accounts = keystore("accounts");
    const ledger = device("ledger");

    const WithLocal = ((provider) =>
      extendNamespace(provider, "key", { store: local })) satisfies Extension;
    const WithLedgerAccounts = ((provider) => ({
      ...extendNamespace(provider, "key", { hardware: { ledger } }),
      ...extendNamespace(provider, "account", { store: accounts }),
    })) satisfies Extension;

    // Heterogeneous array, no `as const`: `withExtensions` keeps the tuple type.
    const Composed = Provider.withExtensions([WithLocal, WithLedgerAccounts]);
    const provider = new Composed({ id: "p1", name: "Wallet" });

    expect(provider.key).toEqual({ store: local, hardware: { ledger } });
    expect(provider.account.store).toBe(accounts);
  });

  it("lets every surface feed the domain's one store and augment the API", () => {
    // Every surface of the domain (Vault at `store`, each hardware device)
    // writes into the single namespace store, so `provider.keys` is one list.
    // A party's surface adds only what the common API cannot offer: a Vault
    // `login`, a Ledger `connect`.
    const vault = { ...keystore("vault"), login: () => {} };
    const WithVault = ((provider, options) => {
      const store = options.keys?.store;
      if (!store) throw new Error("WithVault requires options.keys.store");
      store.add({ id: "vault-1", owner: VAULT });
      return {
        ...extendNamespace(provider, "key", { store: vault }),
        get keys() {
          return store.state.keys;
        },
      };
    }) satisfies Extension;
    const withDevice = (name: "ledger" | "trezor") =>
      ((provider, options) => {
        const store = options.keys?.store;
        if (!store) throw new Error(`${name} requires options.keys.store`);
        const calls: string[] = [];
        const surface: DeviceAPI = {
          ...keystore(name),
          // Not part of the main keystore API: only this party needs it.
          connect: () => {
            calls.push(name);
            store.add({ id: `${name}-1`, owner: `@test/keystore-${name}` });
          },
          calls,
        };
        return extendNamespace(provider, "key", { hardware: { [name]: surface } });
      }) satisfies Extension;

    const store = new KeyListStore();
    const Composed = Provider.withExtensions([
      WithVault,
      withDevice("ledger"),
      withDevice("trezor"),
    ]);
    const provider = new Composed({ id: "p1", name: "Wallet" }, { keys: { store } });

    // No per-surface store: the surfaces share the one injected on the slice.
    expect(provider.options.keys?.store).toBe(store);
    expect(provider.keys.map((k) => k.id)).toEqual(["vault-1"]);

    // Vault's `login` sits on `key.store`; a device's `connect` on its own surface.
    const { key } = provider;
    expect(key.store).toHaveProperty("login");
    expect(key.store).not.toHaveProperty("connect");
    const ledger = key.hardware?.ledger;
    ledger?.connect();

    // Its side effect lands in the single list, tagged with the writing package.
    expect(provider.keys.map((k) => [k.id, k.owner])).toEqual([
      ["vault-1", VAULT],
      ["ledger-1", LEDGER],
    ]);
    expect(ledger?.calls).toEqual(["ledger"]);
    expect(key.hardware?.trezor?.calls).toEqual([]);
  });

  it("fails fast when a second extension takes a mounted name", () => {
    const WithLocal = ((provider) =>
      extendNamespace(provider, "key", { store: keystore("local") })) satisfies Extension;

    const Composed = Provider.withExtensions([WithLocal, WithLocal]);

    expect(() => new Composed({ id: "p1", name: "Wallet" })).toThrow(MountError);
    expect(() => new Composed({ id: "p1", name: "Wallet" })).toThrow(
      /key\.store is already mounted/,
    );
  });
});

describe("ownedBy", () => {
  it("matches entries tagged with exactly the package name", () => {
    const ledger = ownedBy(LEDGER);

    expect(ledger({ owner: LEDGER })).toBe(true);
    expect(ledger({ owner: `${LEDGER}2` })).toBe(false);
    expect(ledger({ owner: ` ${LEDGER} ` })).toBe(false);
    expect(ledger({ owner: TREZOR })).toBe(false);
    expect(ledger({ owner: "" })).toBe(false);
  });

  it("never matches an untagged entry", () => {
    // @ts-expect-error `owner` is required on every entry.
    expect(ownedBy(LOCAL)({})).toBe(false);
    // @ts-expect-error `owner` is a string, never `undefined`.
    expect(ownedBy(LOCAL)({ owner: undefined })).toBe(false);
    // @ts-expect-error the owner is required: there is no default surface.
    expect(ownedBy(undefined)({ owner: LOCAL })).toBe(false);
  });
});

describe("hydrate", () => {
  it("attaches operations without making them part of the entry's data", () => {
    const entry: KeyEntry = { id: "k1", owner: LEDGER };

    const key = hydrate(entry, { sign: (bytes: Uint8Array) => `ledger:${bytes.length}` });

    expect(key).toBe(entry);
    expect(key.sign(new Uint8Array(3))).toBe("ledger:3");
    expect(Object.keys(key)).toEqual(["id", "owner"]);
    expect(JSON.parse(JSON.stringify(key))).toEqual({ id: "k1", owner: LEDGER });
    expect(structuredClone(key)).toEqual({ id: "k1", owner: LEDGER });
    expect({ ...key }).toEqual({ id: "k1", owner: LEDGER });
  });

  it("is idempotent and never replaces an operation the entry already has", () => {
    const first = () => "first";
    const entry = hydrate({ id: "k1" }, { sign: first });

    hydrate(entry, { sign: () => "second" });

    expect(entry.sign).toBe(first);
    expect(() => {
      // @ts-expect-error attached operations are read-only.
      entry.sign = () => "third";
    }).toThrow(TypeError);
  });
});

describe("two paths to one operation", () => {
  /** Hydrates the entries a package owns on every store change. */
  function hydrateOwn(store: KeyListStore, owner: string, label: string) {
    let runs = 0;
    store.subscribe((state) => {
      runs += 1;
      for (const key of state.keys.filter(ownedBy(owner))) {
        hydrate(key, { sign: (bytes: Uint8Array) => `${label}:${key.id}:${bytes.length}` });
      }
    });
    return () => runs;
  }

  /** The local keystore. `key.store.sign(id)` forwards to the operation the owner hydrated. */
  const WithLocal = ((provider, options) => {
    const store = options.keys?.store;
    if (!store) throw new Error("WithLocal requires options.keys.store");
    hydrateOwn(store, LOCAL, "local");
    const api: KeyStoreAPI = {
      label: "local",
      sign(id, bytes) {
        const key = store.state.keys.find((k) => k.id === id);
        if (!key) throw new Error(`unknown key ${id}`);
        if (!key.sign) {
          throw new MountError(`key ${id} has no signer: its owner has not hydrated it`);
        }
        return key.sign(bytes);
      },
    };
    store.add({ id: "local-1", owner: LOCAL });
    return {
      ...extendNamespace(provider, "key", { store: api }),
      get keys() {
        return store.state.keys;
      },
    };
  }) satisfies Extension;

  /** A hardware device's surface. Hydrates only its own keys, forwards `sign` to the device. */
  const WithLedger = ((provider, options) => {
    const store = options.keys?.store;
    if (!store) throw new Error("ledger requires options.keys.store");
    const runs = hydrateOwn(store, LEDGER, "ledger");
    const api: DeviceAPI = {
      ...device("ledger"),
      sign: (id, bytes) => `ledger:${id}:${bytes.length}:direct`,
      runs,
    };
    store.add({ id: "ledger-1", owner: LEDGER });
    return extendNamespace(provider, "key", { hardware: { ledger: api } });
  }) satisfies Extension;

  function compose() {
    const store = new KeyListStore();
    const Composed = Provider.withExtensions([WithLocal, WithLedger]);
    const provider = new Composed({ id: "p1", name: "Wallet" }, { keys: { store } });
    const keyStore = provider.key.store;
    const ledger = provider.key.hardware?.ledger;
    if (!keyStore || !ledger) throw new Error("both surfaces must be mounted");
    return { store, provider, keyStore, ledger };
  }

  it("hydrates each entry with the operation of the surface that owns it", () => {
    const { provider } = compose();
    const bytes = new Uint8Array(4);

    const [local, ledger] = provider.keys;

    // Instance path: the key carries its owner's operation.
    expect(local?.sign?.(bytes)).toBe("local:local-1:4");
    expect(ledger?.sign?.(bytes)).toBe("ledger:ledger-1:4");
    // The list stays data: nothing enumerable was added.
    expect(provider.keys.map((k) => Object.keys(k))).toEqual([
      ["id", "owner"],
      ["id", "owner"],
    ]);
  });

  it("forwards key.store.sign(id) to the hydrated operation", () => {
    const { keyStore } = compose();
    const bytes = new Uint8Array(2);

    // Store path: the same operation, addressed by id.
    expect(keyStore.sign("local-1", bytes)).toBe("local:local-1:2");
    expect(keyStore.sign("ledger-1", bytes)).toBe("ledger:ledger-1:2");
  });

  it("throws a MountError for an entry that is not hydrated", () => {
    const { store, keyStore } = compose();

    // A bridge wrote the entry without emitting: no owner hydrated it yet.
    store.state = { keys: [...store.state.keys, { id: "ledger-2", owner: LEDGER }] };
    expect(() => keyStore.sign("ledger-2", new Uint8Array(1))).toThrow(MountError);
    expect(() => keyStore.sign("ledger-2", new Uint8Array(1))).toThrow(
      /key ledger-2 has no signer/,
    );

    // Owned by a package that is not mounted: the same clear error, not `undefined.sign`.
    store.add({ id: "trezor-1", owner: TREZOR });
    expect(() => keyStore.sign("trezor-1", new Uint8Array(1))).toThrow(MountError);
    expect(() => keyStore.sign("unknown", new Uint8Array(1))).toThrow(/unknown key unknown/);
  });

  it("re-hydrates after a bridge replaces the list", () => {
    const { store, provider, keyStore } = compose();

    // A reconcile replaces every entry with fresh data objects.
    store.setState({ keys: store.state.keys.map((k) => ({ ...k })) });

    const [local, ledger] = provider.keys;
    expect(local?.sign?.(new Uint8Array(1))).toBe("local:local-1:1");
    expect(ledger?.sign?.(new Uint8Array(1))).toBe("ledger:ledger-1:1");
    expect(keyStore.sign("ledger-1", new Uint8Array(1))).toBe("ledger:ledger-1:1");
  });

  it("never lets one package hydrate another package's entries", () => {
    const { store, provider, ledger } = compose();

    // Hydration ran on every emit, yet the local key never got ledger's operation.
    expect(ledger.runs?.()).toBeGreaterThan(1);
    const local = provider.keys.find(ownedBy(LOCAL));
    expect(local?.sign?.(new Uint8Array(1))).toBe("local:local-1:1");

    // An entry whose owner is absent stays data-only.
    store.add({ id: "trezor-1", owner: TREZOR });
    const orphan = provider.keys.find(ownedBy(TREZOR));
    expect(orphan).toBeDefined();
    expect(orphan?.sign).toBeUndefined();
  });
});
