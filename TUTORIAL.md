# Building Reactive Wallets with Providers, Extensions, and Domain Stores

`@algorandfoundation/wallet-provider` is built on a simple idea: a wallet is a set of
independent **capabilities** (keys, accounts, identities, sessions) composed onto a
**provider**, with all state living in **domain stores**: [TanStack Store](https://tanstack.com/store)
atoms that the application creates and hands to the provider. The provider does not own
state; it _operates_ on stores you give it. Every domain is namespaced symmetrically:
its configuration goes in at `options.<plural>` (e.g. `options.accounts.store`), its API
comes out at `provider.<singular>.store` (e.g. `provider.account.store`) and its reactive
state reads at `provider.<plural>` (e.g. `provider.accounts`).

This tutorial walks through how the pieces fit together and why the design pays off in
reactive applications. It ends with a summary of what the architecture means from each of
the two vantage points:

- **App developers**, who compose a provider, wire it to their stores, and bind wallet
  state to a UI.
- **Extension authors**, who implement capabilities and need to know where state goes and
  how commands should behave.

If you just want to wire things up, jump to the composition-root walk-through in the
[README](./README.md#-usage). For how data _moves_ between stores once a provider is
running, and why the whole wallet can be projected as one always-current document, read
[ARCHITECTURE.md](./ARCHITECTURE.md) after this. The mechanics of the options registry and
namespace resolution live in [DISCOVERY.md](./DISCOVERY.md).

## The three building blocks

### 1. The `Provider`: a composition root

A `Provider` holds identity (`id`, `name`, `icon`, `uri`) and merged configuration, and
nothing else. `Provider.withExtensions([...])` produces a specialized class from a list of
extensions, and TypeScript infers the combined surface (`InferExtensions`), so everything
an extension contributes shows up fully typed on the instance. The returned class has a
single constructor signature, `(config: ProviderOptions, options?: ExtensionOptions)`; the
base `class MyWallet extends Provider { … }` form keeps a loose `options` parameter on
purpose so a concrete wallet can own its own option shape. The composed instance type
(`BaseProvider<E>`) is flattened (`Composed`) into a single object, so hovers print one clean
type listing the core provider fields, every namespace an extension contributes
(`connection`, `account`, `key`, …), and any state an extension adds to the global surface
(reactive getters read as `readonly` properties) instead of echoing the extensions list.
The options get the same treatment: since options are handled by extensions, the composed
constructor's `options` parameter (and the instance's `options` property) is
`ExtensionOptions`, the single options type every extension module augments with its
`options.<domain>` namespace via declaration merging, so the property renders as one
compact named type carrying every registered namespace (`options?: ExtensionOptions`).

### 2. Extensions: capability modules

An `Extension` is a plain function `(provider, options) => api`. When a provider is
constructed, each extension runs once and its returned object is merged into the instance
(by own property descriptors, so getters stay getters). This is the same plugin pattern
OctoKit uses: no inheritance hierarchy, no god-object wallet class, just small,
independently testable functions, each responsible for one domain of behavior. Extensions
are **synchronous**: the constructor throws a `TypeError` if one returns a Promise, so
async work belongs inside a method or behind a `ready` promise on the API.

Extensions apply in order, and each one receives the provider as it exists so far, so an
extension can **depend on other extensions**, using the methods and state that earlier
extensions merged onto the instance. Composition is the dependency mechanism:
`withExtensions([WithKeyStore, WithAccounts])` gives `WithAccounts` access to everything
`WithKeyStore` contributed.

### 3. Domain stores: injected reactive state

State is not a single blob and it is not created inside the provider. The application
creates **one store per domain** (keys, accounts, identities, sessions, whatever the
wallet needs) and passes each one in under that domain's key in the provider's options:
the accounts store goes in at `options.accounts.store`, alongside any other configuration
the domain needs. The constructor merges options with `DEFAULTS` and forwards them to every
extension, so each extension picks up its own namespace from the same options bag.

Every domain is namespaced symmetrically, and the convention is the same for every
extension:

| Piece              | Convention                  | Example                               |
| ------------------ | --------------------------- | ------------------------------------- |
| Extension          | `With<DomainPlural>`        | `WithAccounts`                        |
| Configuration in   | `options.<plural>`          | `options.accounts.store`              |
| API out            | `provider.<singular>.store` | `provider.account.store.addAccount()` |
| Reactive state out | `provider.<plural>`         | `provider.accounts`                   |

The same domain name marks the store going in and the API coming out, so the boundary is
legible end to end:

```typescript
import { Store } from "@tanstack/store";
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithKeyStore, type KeyStoreState } from "@algorandfoundation/keystore"; // [published canary]
import { WithAccounts, type AccountStoreState } from "@algorandfoundation/accounts"; // [not published, future meta package]
import { WithIdentities } from "@algorandfoundation/identities"; // [not published]
import { WithSessions } from "@algorandfoundation/sessions"; // [not published]

// One store per domain, each an independent reactive atom
const keys = new Store<KeyStoreState>({ keys: [], status: "idle" });
const accounts = new Store<AccountStoreState>({ wallets: {}, activeWallet: null });
const identities = new Store({ identities: [] });
const sessions = new Store({ connected: false, network: "mainnet" });

const MyWallet = Provider.withExtensions([
  WithKeyStore,
  WithAccounts,
  WithIdentities,
  WithSessions,
]);

const wallet = new MyWallet(
  { id: "my-wallet", name: "My Wallet" },
  {
    // One namespace per domain, each holds that domain's store (plus any other config)
    keystore: { store: keys },
    accounts: { store: accounts },
    identities: { store: identities },
    sessions: { store: sessions },
  },
);

await wallet.account.store.addAccount({ name: "Main", address: "ADDR..." }); // API contributed by WithAccounts, fully typed
wallet.accounts; // reactive state contributed by WithAccounts, fully typed
```

### 4. The options registry: one typed bag

The `options` parameter is a single `ExtensionOptions` interface that every extension
module extends through declaration merging. Each domain registers a **named namespace
interface** (`KeyStoreNamespace`, `AccountsNamespace`, …) under its key, and the platform or
bridge packages that layer on top augment _that_ interface with their extras. The
composition root therefore sees one fully typed block per domain: an unknown namespace or a
misspelled field is a compile error, whichever platform the application installs. The
options and provider namespace registries are described in
[DISCOVERY.md](./DISCOVERY.md#options-registry-and-namespace-resolution).

## The contract between provider and state

Three rules govern how state moves through this architecture. Everything else in the
design follows from them.

**Rule 1: State lives in domain stores, injected from outside.**
Stores are created by the application and passed in via options. Because they exist
independently of the wallet layer, the same stores can be persisted, hydrated on a server,
inspected in devtools, shared with background services, or replaced wholesale in tests;
none of those contexts needs a provider in scope.

**Rule 2: State on the interface is a convenience.**
Properties like `wallet.accounts` are live reads of the underlying store, there for
ergonomic, imperative access. They are not a second copy of the data; the store remains
the single source of truth and is what reactive consumers subscribe to. Exposing them is
optional: the reactive interface is an integration an extension can offer, not an
obligation it must meet.

**Rule 3: Interface methods are store mutations with side effects.**
A method like `connect()` performs its side effect (open a session, hit the network,
follow a deep link) and then commits the outcome to the relevant store with `setState`.
Some operations need no effect at all: setting the active account is just a store
mutation. Either way, the UI never mutates wallet state directly and never polls; it
invokes commands and reacts.

These three rules say _where_ state lives and _who_ may write it. How state then _moves_
between domains (one store per domain, replace-don't-edit, subscribe-don't-call) is the
subject of [ARCHITECTURE.md](./ARCHITECTURE.md#the-three-flow-rules).

## Why this works so well reactively

Wallet state is asynchronous and event-driven by nature: sessions drop, accounts change
from a mobile approval or a deep link, keys are derived and identities restored from a
backup. A UI cannot poll for any of this; it has to react. The architecture above turns
that requirement into structure:

**Reactivity follows domain boundaries.** Because each domain is its own store, a
component watching identities is never woken by a session reconnect, and a session indicator
never re-renders because an account list changed. The granularity of your subscriptions
matches the granularity of your state, by construction, not by careful selector
discipline over one giant object. The namespaces keep that boundary legible end to end:
the same domain name marks the store going in (`options.accounts.store`), the API coming
out (`provider.account.store`) and the reactive state next to it (`provider.accounts`).

**State escapes the wallet layer.** The stores are yours. Persist the sessions store to
storage, snapshot the accounts store in a test, feed the keys store to a service
worker; the provider neither knows nor cares. It is a controller over the stores, not a
silo around them.

**One source of truth per domain.** Imperative code reads snapshots off the interface;
reactive code subscribes to the store. Both always agree, because they are the same data.
There is no synchronization problem to solve because nothing is ever duplicated.

**A single, auditable write-path.** Every mutation of wallet state goes through an
extension method: effect first, `setState` last. When something changes unexpectedly,
there is exactly one layer to look at.

**Framework-agnostic by default.** TanStack Store ships adapters for React, Vue, Solid,
Svelte, and Angular. Since the contract is plain stores rather than framework hooks, one
wallet core serves every framework; the reactivity lives in the stores.

**Cross-domain composition on your terms.** Extensions have two ways to collaborate:
loosely, by reading or deriving from another domain's store, or directly, by depending on
the API a prior extension merged onto the provider. Shared stores keep independent
capabilities decoupled by default; explicit dependencies are there for when one capability
genuinely builds on another.

## For app developers: consuming a provider

You own the stores. Create them, hand them to the provider, and subscribe wherever you
render (the step-by-step version of this, pick extensions, one store per domain, compose,
mind the ordering, is the [README's Usage section](./README.md#-usage)):

```typescript
import { Store } from "@tanstack/store";
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithAccounts, type AccountStoreState } from "@algorandfoundation/accounts"; // [not published, future meta package]

const accounts = new Store<AccountStoreState>({ wallets: {}, activeWallet: null });
const sessions = new Store({ connected: false, network: "mainnet" });

const wallet = new MyWallet(
  { id: "my-wallet", name: "My Wallet" },
  { accounts: { store: accounts }, sessions: { store: sessions } },
);

// Imperative read: convenience access via the domain's reactive getter
console.log(wallet.accounts); // []

// Reactive read: subscribe to the domain you care about
const unsubscribe = accounts.subscribe(() => {
  console.log("accounts changed:", accounts.state.wallets["my-wallet"]?.accounts);
});

await wallet.account.store.addAccount({ name: "Main", address: "ADDR123" }); // side effect + store mutation → subscriber fires
unsubscribe();
```

In React, bind with `useStore` and a selector. The component re-renders only when its
slice of its store changes:

```tsx
import { useStore } from "@tanstack/react-store";

function AccountList({ wallet }: { wallet: InstanceType<typeof MyWallet> }) {
  const list = useStore(accounts, (s) => s.wallets[wallet.id]?.accounts ?? []);

  if (list.length === 0) {
    return (
      <button onClick={() => wallet.account.store.addAccount({ name: "Main", address: "ADDR123" })}>
        Add Account
      </button>
    );
  }
  return (
    <ul>
      {list.map((acc) => (
        <li key={acc.address}>
          {acc.name} ({acc.address})
        </li>
      ))}
    </ul>
  );
}
```

Note the division of labor: components _read_ from stores and use the wallet only to
_invoke commands_. Code that only displays state never needs the provider at all; a
status badge can import the sessions store directly.

## For extension authors: implementing a capability

A typical extension claims its namespace from `options` (its store lives at
`options.<plural>.store`), exposes state as live getters at `provider.<plural>` for
convenience, and returns its API under the singular key, so it merges onto the provider as
`provider.<singular>.store`. Methods follow the command shape: side effect, then mutation.
As a working example we build `WithAccounts` (from `@algorandfoundation/accounts` `[not published, future meta package]`, legacy published `@algorandfoundation/accounts-store` `[published canary]`), an accounts capability managing account records in a store shared with `use-wallet`; the four steps below are the shape every extension follows.

### Step 1: Define the extension types

An extension contributes two things: **state** (the data it manages, mirrored from its
store) and an **API** (methods to interact with that state). Define both, plus the combined
surface the extension merges onto the provider:

```typescript
import type { Store } from "@tanstack/store";

/** A minimal account interface. */
export interface BaseAccount {
  name: string;
  address: string;
  metadata?: Record<string, any>;
}

/** Per-wallet account state (use-wallet compatible). */
export interface WalletState<T = BaseAccount> {
  accounts: T[];
  activeAccount: T | null;
}

/** The shape of the injected domain store. */
export interface AccountStoreState<T = BaseAccount> {
  wallets: Partial<Record<string, WalletState<T>>>;
  activeWallet: string | null;
}

/** The command API mounted at `provider.account.store`. */
export interface AccountStoreApi<T = BaseAccount> {
  addAccount: (account: T) => Promise<T>;
  removeAccount: (address: string) => Promise<void>;
  getAccount: (address: string) => Promise<T | undefined>;
  setActiveAccount: (address: string) => Promise<void>;
  clear: () => Promise<void>;
}

/** Everything `WithAccounts` merges onto the provider. */
export interface AccountStoreExtension<T = BaseAccount> {
  /** Reactive state: live reads of the store at `provider.accounts` */
  readonly accounts: T[];
  /** The API namespace: `provider.account.store` */
  account: { store: AccountStoreApi<T> };
}
```

### Step 2: Implement the extension function

An extension is a plain function with the signature `(provider, options) => api`. It runs
once, synchronously, when the provider is constructed, and whatever it returns is merged
onto the provider instance:

```typescript
import type { Extension, Provider } from "@algorandfoundation/wallet-provider";
import { Store } from "@tanstack/store";
import type {
  AccountStoreExtension,
  AccountStoreOptions,
  AccountStoreState,
  BaseAccount,
} from "./types"; // see Step 3

export const WithAccounts = <T extends BaseAccount>(
  provider: Provider<any> & Partial<AccountStoreExtension<T>>,
  options?: AccountStoreOptions<T>,
): AccountStoreExtension<T> => {
  // Claim the domain's store from its namespace, or default to an empty store
  const store =
    options?.accounts?.store ??
    new Store<AccountStoreState<T>>({ wallets: {}, activeWallet: null });

  // Accounts are partitioned per walletKey; defaults to provider.id
  const walletKey = options?.accounts?.walletKey ?? provider.id;

  return {
    // Reactive state: live getter reading the wallet's accounts slice
    get accounts() {
      return store.state.wallets[walletKey]?.accounts ?? [];
    },

    // The API namespace: provider.account.store
    account: {
      store: {
        // Commands: side effect first (if any), mutation last
        async addAccount(account: T) {
          store.setState((state) => {
            const current = state.wallets[walletKey] ?? { accounts: [], activeAccount: null };
            return {
              ...state,
              wallets: {
                ...state.wallets,
                [walletKey]: {
                  ...current,
                  accounts: [
                    ...current.accounts.filter((a) => a.address !== account.address),
                    account,
                  ],
                  activeAccount: current.activeAccount ?? account,
                },
              },
            };
          });
          return account;
        },

        async removeAccount(address: string) {
          store.setState((state) => {
            const current = state.wallets[walletKey];
            if (!current) return state;
            const accounts = current.accounts.filter((a) => a.address !== address);
            return {
              ...state,
              wallets: {
                ...state.wallets,
                [walletKey]: {
                  ...current,
                  accounts,
                  activeAccount:
                    current.activeAccount?.address === address
                      ? (accounts[0] ?? null)
                      : current.activeAccount,
                },
              },
            };
          });
        },

        async getAccount(address: string) {
          return store.state.wallets[walletKey]?.accounts.find((a) => a.address === address);
        },

        async setActiveAccount(address: string) {
          store.setState((state) => {
            const current = state.wallets[walletKey];
            if (!current) return state;
            const target = current.accounts.find((a) => a.address === address) ?? null;
            return {
              ...state,
              wallets: {
                ...state.wallets,
                [walletKey]: {
                  ...current,
                  activeAccount: target,
                },
              },
            };
          });
        },

        async clear() {
          store.setState((state) => ({
            ...state,
            wallets: {
              ...state.wallets,
              [walletKey]: { accounts: [], activeAccount: null },
            },
          }));
        },
      },
    },
  };
};
```

Four details matter here:

- **State is exposed as live getters**, not copied values. A getter reads the store on
  every access (`store.state.wallets[walletKey]?.accounts ?? []`), so it can never go stale; an assigned value is stale the moment an async
  event lands. Consumers needing reactivity subscribe to the store itself.
- **Mutations replace state, they never edit it in place.** `setState` builds a new object
  from the old one. [ARCHITECTURE.md](./ARCHITECTURE.md#flow-rule-2-replace-dont-edit)
  explains why.
- **The function is synchronous.** `addAccount()` and other commands are async, the extension function is not. Returning a
  Promise from the extension itself makes the constructor throw a `TypeError`.
- **`walletKey` scoping and `use-wallet` compatibility.** Partitioning accounts under `wallets[walletKey]` enables a single `AccountStoreState` store instance to be shared across multiple providers or with `@txnlab/use-wallet`'s `WalletManager({ options: { store } })`. When `options.accounts.walletKey` is omitted, it defaults to `provider.id`.

### Step 3: Register your options namespace

The extension reads `options.accounts.store`, so the `accounts` namespace has to exist on
the shared `ExtensionOptions` registry. Register it once with a named, exported interface
and module augmentation, and derive the extension's own `options` type from it:

```typescript
import type { Store } from "@tanstack/store";
import type { ExtensionOptions } from "@algorandfoundation/wallet-provider";
import type { AccountStoreState, BaseAccount } from "./types";

/** The `options.accounts` namespace. Bridges augment this interface. */
export interface AccountsNamespace {
  /** The domain's injected store, created by the application or shared with use-wallet */
  store?: Store<AccountStoreState<any>>;
  /** Wallet key in the store, defaults to provider.id */
  walletKey?: string;
}

declare module "@algorandfoundation/wallet-provider" {
  interface ExtensionOptions {
    accounts?: AccountsNamespace; // optional: providers without WithAccounts share the registry
  }
}

/** Narrowed for the extension itself: it can be typed against a concrete account model. */
export interface AccountStoreOptions<T extends BaseAccount = BaseAccount> extends Omit<
  ExtensionOptions,
  "accounts"
> {
  accounts?: AccountsNamespace & {
    store?: Store<AccountStoreState<T>>;
  };
}
```

Every module's registration merges into that one options type, so app developers get
completion and checking on the whole bag while `options` renders as a single named type.
The full rules for the options and provider namespace registries, augmenting another package's
namespace, and extending one namespace from several surfaces are in
[DISCOVERY.md](./DISCOVERY.md#registering-a-namespace).

### Step 4: Use it in a provider

Compose it like any other extension. The constructor's `options` now accepts (and checks)
the `accounts` namespace:

```typescript
import { Store } from "@tanstack/store";
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithAccounts, type AccountStoreState } from "./accounts";

const accounts = new Store<AccountStoreState>({ wallets: {}, activeWallet: null });

const MyWallet = Provider.withExtensions([WithAccounts]);
const wallet = new MyWallet(
  { id: "my-wallet", name: "My Wallet" },
  { accounts: { store: accounts } },
);

await wallet.account.store.addAccount({ name: "Main", address: "ADDR123" });
console.log(wallet.accounts); // live read: [{ name: "Main", address: "ADDR123" }]
```

### Guidelines that keep extensions composable

The checklist lives in
[DISCOVERY.md](./DISCOVERY.md#rules-that-keep-extensions-composable); the reasoning is
short:

- **Take your store from your namespace; never create private ones.** A store hidden inside
  a closure cannot be persisted, tested, or observed from outside; it defeats the design.
- **One domain, one namespace, on both sides.** The same domain name on `options.<plural>`
  and `provider.<singular>.store` is what lets an app developer (or a discovery mechanism)
  find your capability without reading your source. Write only to your domain's store;
  reading other domains' stores is fine, writing to them is another extension's job.
- **Effect first, mutation last.** Feed external events (session drops, deep-link
  callbacks, network pushes) into the store the same way as commands, and every subscriber
  updates for free.

### Not every extension looks like this

The `WithAccounts` example shows the full pattern, but extensions come in several shapes,
and most capabilities only need part of it.

**Depending on another extension.** Because extensions apply in order, a later extension
can build directly on what earlier ones contributed: call their methods, read their
convenience state:

```typescript
type IdentitiesExtension = {
  identity: {
    store: {
      /** Resolve the DID of the first account */
      resolve: () => Promise<string>;
    };
  };
};

export const WithIdentities: Extension<IdentitiesExtension> = (provider, options) => {
  return {
    identity: {
      store: {
        async resolve() {
          // Depends on WithAccounts: reads the state it already merged onto the provider
          const active = provider.accounts[0];
          const identity = getIdentity(active?.address);
          return identity.did;
        },
      },
    },
  };
};

// Order matters: WithAccounts must apply before WithIdentities
const MyWallet = Provider.withExtensions([WithAccounts, WithIdentities]);
```

Prefer stores for loose collaboration between peers; use a direct dependency when one
capability is genuinely built on top of another, and document the required ordering.

**Optional reactive integration.** The reactive interface is opt-in. An extension can
check whether a store was provided and integrate when it is, while remaining fully
functional without it:

```typescript
type LoggerExtension = { log: (msg: string) => void };

export const WithLogger: Extension<LoggerExtension> = (provider, options) => {
  // Reactive integration is optional: wire it up only if the store is there
  if (options.sessions?.store) {
    options.sessions.store.subscribe(() => {
      console.log(`[${provider.name}] session:`, options.sessions.store.state);
    });
  }

  return { log: (msg) => console.log(`[${provider.name}] ${msg}`) };
};
```

The same extension works in a minimal setup with no stores and in a fully reactive one;
consumers choose how much reactivity they inject. (A cross-cutting utility like this one
owns no domain, so it merges `log` flat rather than claiming a namespace.)

**Just mutating the store.** Some extensions expose little or no API at all. Their entire
job is to feed events into a store: a **bridge** that watches one domain's store and feeds another. For example:

- **`WithAccountsKeystore`** (`@algorandfoundation/accounts-keystore-extension` `[published canary, reference example, not for production]`): watches `options.keystore.store`, derives accounts with `sign` delegating back to keystore keys, writes to `options.accounts.store`, and returns `{}` because the store mutations are the entire capability. It has no chain address scheme (accounts are keyed by the base64 public key), so use it to learn the bridge pattern or as a starting point, never as the accounts bridge of a shipping wallet.
- **`WithAlgorandAccounts`** (`@algorandfoundation/algorand-accounts-extension` `[not published]`): production Algorand bridge that derives Algorand addresses (Ed25519, Falcon-1024), watches ALGO/ASA balances via algod/indexer, writes to `options.accounts.store`, and contributes `provider.algorand`.
- **`WithAccountsConnections`** (`@algorandfoundation/accounts-connections-extension` `[not published]`): mounts a session-scoped remote mirror at `provider.account.remote`.

No one ever calls a method on an extension that returns `{}`, yet every subscriber of the accounts store reacts to its writes: the store is the interface. The shape is spelled out in
[Extensions that expose no API](./DISCOVERY.md#extensions-that-expose-no-api), and
[ARCHITECTURE.md](./ARCHITECTURE.md#bridges-routing-keys-by-role) shows where bridges sit
in the overall flow.

### Deriving across domains

When a capability needs a value computed from other domains, but no direct dependency on
another extension, use `Derived` with the relevant stores as dependencies. The extensions
involved never need to reference each other:

```typescript
import { Derived } from "@tanstack/store";

type ActiveIdentityExtension = {
  activeIdentity: {
    /** The derived atom: subscribe to it like any store */
    atom: Derived<string | null>;
    /** Convenience accessor */
    readonly did: string | null;
  };
};

export const WithActiveIdentity: Extension<ActiveIdentityExtension> = (provider, options) => {
  const accounts = options.accounts?.store;
  const identities = options.identities?.store;
  if (!accounts || !identities) {
    throw new Error(
      "WithActiveIdentity requires options.accounts.store and options.identities.store",
    );
  }

  const walletKey = options.accounts?.walletKey ?? provider.id;

  const atom = new Derived({
    fn: () => {
      const activeAddress = accounts.state.wallets[walletKey]?.activeAccount?.address;
      return identities.state.identities.find((i) => i.address === activeAddress)?.did ?? null;
    },
    deps: [accounts, identities], // recomputes when either domain changes
  });
  atom.mount();

  return {
    activeIdentity: {
      atom,
      get did() {
        return atom.state;
      },
    },
  };
};
```

`wallet.activeIdentity.did` now tracks the active account's identity across two domains: declared
once, updated automatically, with zero coupling between the extensions that maintain those
domains.

## The two perspectives, summarized

**If you build apps**, the provider is a _typed command surface over state you already
own_. You create a store per domain, pass each in under its namespace, and subscribe exactly
where you render, with selectors, adapters, or `Derived` values, in any framework. You
never mutate wallet state and never poll for it: you call `wallet.account.store.addAccount(...)`
and your subscriptions fire. And because the stores are yours, everything else you do with
state (persistence, SSR, devtools, testing) works on wallet state too, with no
wallet-specific machinery.

**If you build extensions**, you implement one domain as a self-contained module: claim
your namespace from the injected options (`options.<plural>.store`), return your API under
the singular key (`provider.<singular>.store`), expose live getters at `provider.<plural>`
for convenient reads, and shape every operation as a command: perform the side effect,
commit the result with `setState`.
You collaborate with other capabilities through their stores (reading or deriving) or by
depending directly on the APIs earlier extensions contributed, and you integrate with the
reactive interfaces as much or as little as your capability needs, down to an extension
that exposes no API and simply feeds events into a store. That flexibility is what lets
independently developed extensions compose into one coherent, fully typed wallet.

One sentence for both: **domain stores make wallet state reactive, portable, and
inspectable; extensions make wallet behavior modular and typed; the provider is the thin
seam that binds them together.**

## Further reading

- [README.md](./README.md#-usage): the composition-root walk-through: pick extensions, one
  store per domain, `withExtensions`, ordering, and using the composed provider.
- [ARCHITECTURE.md](./ARCHITECTURE.md): how data flows between stores once a provider is
  running: standalone vs composed, the three flow rules, bridges, and projecting the whole
  wallet as one DID document.
- [DISCOVERY.md](./DISCOVERY.md): the options registry, namespace registration, extension and resolution, and the checklist that keeps extensions composable.
- The [architectural decision records](.decisions/0001-provider-and-extensions.md) for the
  reasoning behind the provider/extension split.
