# Building Reactive Wallets with Providers, Extensions, and Domain Stores

`@algorandfoundation/wallet-provider` is built on a simple idea: a wallet is a set of
independent **capabilities** (keys, accounts, identities, sessions) composed onto a
**provider**, with all state living in **domain stores** — [TanStack Store](https://tanstack.com/store)
atoms that the application creates and hands to the provider. The provider does not own
state; it _operates_ on stores you give it. Every domain is namespaced symmetrically:
its configuration goes in at `options.<domain>` (e.g. `options.accounts.store`) and its
interface comes out at `provider.<domain>` (e.g. `provider.accounts`).

This tutorial walks through how the pieces fit together and why the design pays off in
reactive applications. It ends with a summary of what the architecture means from each of
the two vantage points:

- **App developers**, who compose a provider, wire it to their stores, and bind wallet
  state to a UI.
- **Extension authors**, who implement capabilities and need to know where state goes and
  how commands should behave.

## The three building blocks

### 1. The `Provider` — a composition root

A `Provider` holds identity (`id`, `name`, `icon`, `uri`) and merged configuration, and
nothing else. `Provider.withExtensions([...])` produces a specialized class from a list of
extensions, and TypeScript infers the combined surface (`InferExtensions`), so everything
an extension contributes shows up fully typed on the instance.

### 2. Extensions — capability modules

An `Extension` is a plain function `(provider, options) => api`. When a provider is
constructed, each extension runs once and its returned object is merged into the instance.
This is the same plugin pattern OctoKit uses: no inheritance hierarchy, no god-object
wallet class — just small, independently testable functions, each responsible for one
domain of behavior.

Extensions apply in order, and each one receives the provider as it exists so far — so an
extension can **depend on other extensions**, using the methods and state that earlier
extensions merged onto the instance. Composition is the dependency mechanism:
`withExtensions([withKeys, withAccounts])` gives `withAccounts` access to everything
`withKeys` contributed.

### 3. Domain stores — injected reactive state

State is not a single blob and it is not created inside the provider. The application
creates **one store per domain** — keys, accounts, identities, sessions, whatever the
wallet needs — and passes each one in under that domain's key in the provider's options:
the accounts store goes in at `options.accounts.store`, alongside any other configuration
the domain needs. The constructor merges options with `DEFAULTS` and forwards them to every
extension, so each extension picks up its own namespace from the same options bag:

```typescript
import { Store } from "@tanstack/store";
import { Provider } from "@algorandfoundation/wallet-provider";

// One store per domain — each an independent reactive atom
const keys = new Store({ list: [] as Key[], status: "idle" as string });
const accounts = new Store({ list: [] as string[], active: null as string | null });
const identities = new Store({ list: [] as Identity[] });
const sessions = new Store({ connected: false, network: "mainnet" });

const MyWallet = Provider.withExtensions([withKeys, withAccounts, withIdentities, withSessions]);

const wallet = new MyWallet(
  { id: "my-wallet", name: "My Wallet" },
  {
    // One namespace per domain — each holds that domain's store (plus any other config)
    keys: { store: keys },
    accounts: { store: accounts },
    identities: { store: identities },
    sessions: { store: sessions },
  },
);

wallet.sessions.connect(); // contributed by withSessions — fully typed
wallet.accounts.list; // contributed by withAccounts — fully typed
```

## The contract between provider and state

Three rules govern how state moves through this architecture. Everything else in the
design follows from them.

**Rule 1 — State lives in domain stores, injected from outside.**
Stores are created by the application and passed in via options. Because they exist
independently of the wallet layer, the same stores can be persisted, hydrated on a server,
inspected in devtools, shared with background services, or replaced wholesale in tests —
none of those contexts needs a provider in scope.

**Rule 2 — State on the interface is a convenience.**
Properties like `wallet.accounts.list` are live reads of the underlying store, there for
ergonomic, imperative access. They are not a second copy of the data; the store remains
the single source of truth and is what reactive consumers subscribe to. Exposing them is
optional: the reactive interface is an integration an extension can offer, not an
obligation it must meet.

**Rule 3 — Interface methods are store mutations with side effects.**
A method like `connect()` performs its side effect (open a session, hit the network,
follow a deep link) and then commits the outcome to the relevant store with `setState`.
Some operations need no effect at all — setting the active account is just a store
mutation. Either way, the UI never mutates wallet state directly and never polls — it
invokes commands and reacts.

## Why this works so well reactively

Wallet state is asynchronous and event-driven by nature: sessions drop, accounts change
from a mobile approval or a deep link, keys are derived and identities restored from a
backup. A UI cannot poll for any of this — it has to react. The architecture above turns
that requirement into structure:

**Reactivity follows domain boundaries.** Because each domain is its own store, a
component watching identities is never woken by a session reconnect, and a session indicator
never re-renders because an account list changed. The granularity of your subscriptions
matches the granularity of your state — by construction, not by careful selector
discipline over one giant object. The namespaces keep that boundary legible end to end:
the same domain name marks the store going in (`options.accounts.store`) and the
interface coming out (`provider.accounts`).

**State escapes the wallet layer.** The stores are yours. Persist the sessions store to
storage, snapshot the accounts store in a test, feed the keys store to a service
worker — the provider neither knows nor cares. It is a controller over the stores, not a
silo around them.

**One source of truth per domain.** Imperative code reads snapshots off the interface;
reactive code subscribes to the store. Both always agree, because they are the same data.
There is no synchronization problem to solve because nothing is ever duplicated.

**A single, auditable write-path.** Every mutation of wallet state goes through an
extension method: effect first, `setState` last. When something changes unexpectedly,
there is exactly one layer to look at.

**Framework-agnostic by default.** TanStack Store ships adapters for React, Vue, Solid,
Svelte, and Angular. Since the contract is plain stores rather than framework hooks, one
wallet core serves every framework — the reactivity lives in the stores.

**Cross-domain composition on your terms.** Extensions have two ways to collaborate:
loosely, by reading or deriving from another domain's store, or directly, by depending on
the API a prior extension merged onto the provider. Shared stores keep independent
capabilities decoupled by default; explicit dependencies are there for when one capability
genuinely builds on another.

## For app developers: consuming a provider

You own the stores. Create them, hand them to the provider, and subscribe wherever you
render:

```typescript
const accounts = new Store({ list: [] as string[], active: null as string | null });
const sessions = new Store({ connected: false, network: "mainnet" });

const wallet = new MyWallet(
  { id: "my-wallet", name: "My Wallet" },
  { accounts: { store: accounts }, sessions: { store: sessions } },
);

// Imperative read — convenience access via the domain's namespace
console.log(wallet.accounts.list); // []

// Reactive read — subscribe to the domain you care about
const unsubscribe = accounts.subscribe(() => {
  console.log("accounts changed:", accounts.state.list);
});

await wallet.accounts.connect(); // side effect + store mutation → subscriber fires
unsubscribe();
```

In React, bind with `useStore` and a selector. The component re-renders only when its
slice of its store changes:

```tsx
import { useStore } from "@tanstack/react-store";

function AccountList({ wallet }: { wallet: InstanceType<typeof MyWallet> }) {
  const list = useStore(accounts, (s) => s.list);

  if (list.length === 0) {
    return <button onClick={() => wallet.accounts.connect()}>Connect</button>;
  }
  return (
    <ul>
      {list.map((addr) => (
        <li key={addr}>{addr}</li>
      ))}
    </ul>
  );
}
```

Note the division of labor: components _read_ from stores and use the wallet only to
_invoke commands_. Code that only displays state never needs the provider at all — a
status badge can import the sessions store directly.

## For extension authors: implementing a capability

A typical extension claims its namespace from `options` (its store lives at
`options.<domain>.store`), exposes state as live getters for convenience, and returns its
API under the same domain key — so it merges onto the provider as `provider.<domain>`.
Methods follow the command shape — side effect, then mutation:

```typescript
import type { Store } from "@tanstack/store";
import type { Extension } from "@algorandfoundation/wallet-provider";

type AccountsState = { list: string[]; active: string | null };

type AccountsApi = {
  accounts: {
    /** Convenience: live view of connected addresses */
    readonly list: string[];
    readonly active: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
  };
};

export const withAccounts: Extension<AccountsApi> = (provider, options) => {
  // Claim the domain's store from its namespace — injected, never created here
  const store: Store<AccountsState> = options.accounts.store;

  return {
    // Everything this extension contributes lives under provider.accounts
    accounts: {
      // Convenience: live getters over the store
      get list() {
        return store.state.list;
      },
      get active() {
        return store.state.active;
      },

      // Commands: side effect first, mutation last
      async connect() {
        const session = await openWalletSession(provider.uri, options); // side effect
        store.setState(() => ({
          list: session.addresses,
          active: session.addresses[0] ?? null,
        })); // mutation
      },
      disconnect() {
        closeWalletSession(provider.uri); // side effect
        store.setState(() => ({ list: [], active: null })); // mutation
      },
    },
  };
};
```

Guidelines that keep extensions composable:

- **Take your store from your namespace; never create private ones.** Your domain's store
  arrives at `options.<domain>.store`. A store hidden inside a closure cannot be
  persisted, tested, or observed from outside — it defeats the design.
- **One domain, one namespace — on both sides.** Read configuration from
  `options.<domain>` and return your API under the same key, so it lands at
  `provider.<domain>`. Write only to your domain's store; reading other domains' stores is
  fine, writing to them is another extension's job.
- **Same-key returns merge; conflicts throw.** When a later extension re-returns an
  existing domain key (a bridge extension augmenting another domain's store, for
  example), both values must be plain objects: new entries merge in, reference-equal
  values are no-ops, nested plain objects merge recursively. A differing leaf value, an
  accessor, or a non-plain value under an existing key throws `ExtensionCollisionError` —
  an extension can extend a namespace, never silently replace what another one put there.
  Base provider properties (`id`, `name`, `icon`, `uri`, `options`) and `toJSON` are
  reserved outright, and every contribution is sealed once it lands.
- **If you expose state, expose live getters, not copies.** A getter reads the store on
  every access; an assigned value is stale the moment an async event lands. Consumers
  needing reactivity subscribe to the store itself.
- **Effect first, mutation last.** Perform the side effect, then commit the outcome in one
  `setState`. Feed external events (session drops, deep-link callbacks, network pushes)
  into the store the same way, and every subscriber updates for free. Commands without an
  effect are fine too — they are just mutations.

### Not every extension looks like this

The `withAccounts` example shows the full pattern, but extensions come in several shapes,
and most capabilities only need part of it.

**Depending on another extension.** Because extensions apply in order, a later extension
can build directly on what earlier ones contributed — call their methods, read their
convenience state:

```typescript
type IdentitiesApi = {
  identities: {
    /** Resolve the DID of the active account */
    resolve: () => Promise<string>;
  };
};

export const withIdentities: Extension<IdentitiesApi> = (provider, options) => {
  return {
    identities: {
      async resolve() {
        // Depends on withAccounts: reads the namespace it already merged onto the provider
        const identity = getIdentity(provider.accounts.active);
        return identity.did;
      },
    },
  };
};

// Order matters: withAccounts must apply before withIdentities
const MyWallet = Provider.withExtensions([withAccounts, withIdentities]);
```

Prefer stores for loose collaboration between peers; use a direct dependency when one
capability is genuinely built on top of another — and document the required ordering.

**Optional reactive integration.** The reactive interface is opt-in. An extension can
check whether a store was provided and integrate when it is, while remaining fully
functional without it:

```typescript
type LoggerApi = { log: (msg: string) => void };

export const withLogger: Extension<LoggerApi> = (provider, options) => {
  // Reactive integration is optional — wire it up only if the store is there
  if (options.sessions?.store) {
    options.sessions.store.subscribe(() => {
      console.log(`[${provider.name}] session:`, options.sessions.store.state);
    });
  }

  return { log: (msg) => console.log(`[${provider.name}] ${msg}`) };
};
```

The same extension works in a minimal setup with no stores and in a fully reactive one —
consumers choose how much reactivity they inject. (A cross-cutting utility like this one
owns no domain, so it merges `log` flat rather than claiming a namespace.)

**Just mutating the store.** Some extensions expose little or no API at all. Their entire
job is to feed events into a store — a bridge that watches the keys store and routes
identity-context keys into the identities store, for example:

```typescript
export const withIdentityWatcher: Extension<object> = (provider, options) => {
  const keys = options.keys.store;
  const identities = options.identities.store;

  // Route every identity-context key into the identities store
  keys.subscribe(() => {
    const identityKeys = keys.state.list.filter((k) => k.metadata?.context === 1);
    identities.setState(() => ({
      list: identityKeys.map((k) => createKeyIdentity(k)),
    }));
  });

  return {}; // nothing merged — the store mutations are the whole capability
};
```

No one ever calls a method on this extension, yet every subscriber of `identities` reacts
to its writes. The store is the interface.

### Deriving across domains

When a capability needs a value computed from other domains — but no direct dependency on
another extension — use `Derived` with the relevant stores as dependencies. The extensions
involved never need to reference each other:

```typescript
import { Derived } from "@tanstack/store";

type ActiveIdentityApi = {
  activeIdentity: {
    /** The derived atom — subscribe to it like any store */
    atom: Derived<string | null>;
    /** Convenience accessor */
    readonly did: string | null;
  };
};

export const withActiveIdentity: Extension<ActiveIdentityApi> = (provider, options) => {
  const accounts = options.accounts.store;
  const identities = options.identities.store;

  const atom = new Derived({
    fn: () => identities.state.list.find((i) => i.address === accounts.state.active)?.did ?? null,
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

`wallet.activeIdentity.did` now tracks the active account's identity across two domains — declared
once, updated automatically, with zero coupling between the extensions that maintain those
domains.

## The two perspectives, summarized

**If you build apps**, the provider is a _typed command surface over state you already
own_. You create a store per domain, pass each in under its namespace, and subscribe exactly
where you render — with selectors, adapters, or `Derived` values, in any framework. You
never mutate wallet state and never poll for it: you call `wallet.accounts.connect()` and your
subscriptions fire. And because the stores are yours, everything else you do with state —
persistence, SSR, devtools, testing — works on wallet state too, with no wallet-specific
machinery.

**If you build extensions**, you implement one domain as a self-contained module: claim
your namespace from the injected options (`options.<domain>.store`), return your API under
the same key (`provider.<domain>`), expose live getters for convenient reads, and shape
every operation as a command — perform the side effect, commit the result with `setState`.
You collaborate with other capabilities through their stores (reading or deriving) or by
depending directly on the APIs earlier extensions contributed, and you integrate with the
reactive interfaces as much or as little as your capability needs — down to an extension
that exposes no API and simply feeds events into a store. That flexibility is what lets
independently developed extensions compose into one coherent, fully typed wallet.

One sentence for both: **domain stores make wallet state reactive, portable, and
inspectable; extensions make wallet behavior modular and typed; the provider is the thin
seam that binds them together.**
