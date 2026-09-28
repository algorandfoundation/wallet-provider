# 💳 Wallet Provider

<p align="center">
  <img src="https://raw.githubusercontent.com/algorandfoundation/wallet-provider/refs/heads/main/assets/banner.png" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/algorandfoundation/wallet-provider/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@algorandfoundation/wallet-provider" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@algorandfoundation/wallet-provider"><img src="https://img.shields.io/npm/v/@algorandfoundation/wallet-provider?logo=npm" alt="NPM Version" /></a>
  <a href="https://github.com/algorandfoundation/wallet-provider/stargazers"><img src="https://img.shields.io/github/stars/algorandfoundation/wallet-provider?style=social" alt="GitHub stars" /></a>
</p>

A modular, extensible wallet provider abstraction for wallet providers.
Inspired by the architecture of OctoKit and TxnLab's `use-wallet`, this package provides a base for building wallet integrations that can be dynamically extended with additional functionality.

### 🏗️ Provider

The `Provider` is the base class that represents a wallet's identity and core configuration. It manages:

- **Configuration**: Shared options for the provider and its extensions.
- **Composition**: Orchestrating the application of extensions.

### 🧩 Extensions

Extensions are modular functions that augment the `Provider` with specific capabilities.

- **Responsibility**: Extensions handle domain-specific logic such as account management, transaction signing, or specific API integrations (e.g., Liquid, OIDC).
- **Flexibility**: They can be independent packages, provided by third parties, or baseline defaults (like KeyStore + BIP39).
- **Prefer Composition**: Use `withExtensions` to create specialized Provider classes with a fixed set of extensions.

## 🚀 Usage

The following walk-through assembles a provider from several extensions at your
application's **composition root** and wires it to your stores. It sticks to the steps; the
reasoning behind each one is in the [TUTORIAL](./TUTORIAL.md), and how data then flows
between the stores is in [ARCHITECTURE](./ARCHITECTURE.md).

### 1. Pick your extensions

An extension is a plain, synchronous function `(provider, options) => api` exported as
`With<DomainPlural>`. Install the packages for the domains you need, for example:

- `@algorandfoundation/keystore` [published canary]
- `@algorandfoundation/accounts` [not published, future meta package]
- `@algorandfoundation/accounts-keystore-extension` [published canary, reference example, not for production]
- `@algorandfoundation/provider-migrations` [published canary]

(see [For extension authors](./TUTORIAL.md#for-extension-authors-implementing-a-capability)).
The examples below use `WithKeyStore`, `WithAccounts`, and `WithAccountsKeystore`.

> [!NOTE]
> `WithAccountsKeystore` appears in this walkthrough because it is the smallest published
> bridge and shows the pattern end to end. It is a **reference implementation only**: it has
> no chain address scheme and keys each account by the raw (base64) public key. For a real
> Algorand wallet substitute the chain-specific bridge, `WithAlgorandAccounts`
> (`@algorandfoundation/algorand-accounts-extension` [not published]), which owns Algorand
> and Falcon-1024 address derivation.

### 2. Create one store per domain

You own the stores. Create one [TanStack Store](https://tanstack.com/store) atom per domain
and keep them at your composition root:

```typescript
import { Store } from "@tanstack/store";
import type { KeyStoreState } from "@algorandfoundation/keystore";
import type { AccountStoreState } from "@algorandfoundation/accounts";

const keysStore = new Store<KeyStoreState>({ keys: [], status: "idle" });
const accountsStore = new Store<AccountStoreState>({
  wallets: {},
  activeWallet: null,
});
```

Because you create the stores, you can also persist them, hydrate them on a server, inspect
them in devtools, or swap them wholesale in tests. The provider operates on them; it does
not own them ([why](./TUTORIAL.md#the-contract-between-provider-and-state)).

### 3. Compose and instantiate

`Provider.withExtensions([...])` composes a class on the fly. Its constructor is
`(config: ProviderOptions, options?: ExtensionOptions)`: each extension's configuration,
including its store, goes in under that domain's namespace, `options.<plural>`:

```typescript
import { Provider, type ProviderOptions } from "@algorandfoundation/wallet-provider";
import { WithKeyStore } from "@algorandfoundation/keystore";
import { WithAccounts } from "@algorandfoundation/accounts";
import { WithAccountsKeystore } from "@algorandfoundation/accounts-keystore-extension";

const MyWallet = Provider.withExtensions([WithKeyStore, WithAccounts, WithAccountsKeystore]);

const config: ProviderOptions = {
  id: "my-wallet",
  name: "My Wallet",
  icon: "https://example.com/icon.png",
};

const wallet = new MyWallet(config, {
  keystore: { store: keysStore },
  accounts: { store: accountsStore },
});
```

When you want a named, importable class, extend the composed one:

```typescript
export class MyWalletProvider extends Provider.withExtensions([
  WithKeyStore,
  WithAccounts,
  WithAccountsKeystore,
]) {}
```

Either way, TypeScript infers the combined surface: everything each extension contributes
shows up fully typed on the instance, and `options` is the single `ExtensionOptions`
registry, so an unregistered namespace or a misspelled field is a compile error. (The plain
`class MyWallet extends Provider { … }` form deliberately keeps `options` loose so a
concrete wallet can own its option shape; see [DISCOVERY](./DISCOVERY.md#options-registry-and-namespace-resolution).)

### 4. Mind the ordering

Extensions apply in order, and each one receives the provider as it exists so far. An
extension that depends on another's API (a bridge that reads from the keystore, say) must
come after it (bridges are named `With<Domain><Dependency>`):

```typescript
// Correct: the bridge can see everything WithKeyStore and WithAccounts contributed.
// (Swap WithAccountsKeystore for WithAlgorandAccounts in a real Algorand wallet.)
Provider.withExtensions([WithKeyStore, WithAccounts, WithAccountsKeystore]);

// Wrong: the bridge applies first and finds no keys API on the provider.
Provider.withExtensions([WithAccountsKeystore, WithKeyStore, WithAccounts]);
```

Extensions that only collaborate through shared stores have no ordering constraint.

### 5. Use the composed provider

Invoke commands on the provider's API namespace (`provider.<singular>.store`); read state
through the reactive getters (`provider.<plural>`) or subscribe to the stores you created:

```typescript
// Commands go through the provider.
await wallet.account.store.addAccount({ ... });

// Reads can go through convenience getters...
console.log(wallet.accounts);

// ...or reactively through the store you created.
accountsStore.subscribe(() => {
  console.log("accounts changed:", accountsStore.state.wallets);
});
```

In React, bind a store slice with a selector so components re-render only when their slice
changes: components read from stores and use the provider only to invoke commands
([example](./TUTORIAL.md#for-app-developers-consuming-a-provider)).

## 📚 Where the docs live

This repository is the single home for the **concepts and how-tos** of the provider /
extension model:

- [README.md](./README.md): this composition-root walk-through.
- [TUTORIAL.md](./TUTORIAL.md): the building blocks, the provider ↔ state contract, and
  the app-developer and extension-author perspectives.
- [ARCHITECTURE.md](./ARCHITECTURE.md): how data flows through a provider: standalone vs
  composed, the flow rules, bridges, and the whole wallet as one document.
- [DISCOVERY.md](./DISCOVERY.md): the options registry, namespace resolution, and the rules
  that keep extensions composable.
- [Architectural Decision Records](.decisions/0001-provider-and-extensions.md): why the
  design is the way it is.
- `docs/`: the generated API reference (`pnpm docs`).

The [`wallet-provider-extensions`](https://github.com/algorandfoundation/wallet-provider-extensions)
repository documents only its **per-package flows** (keystore, migrations, logs, …).

Consult the [CONTRIBUTING](./CONTRIBUTING.md) guide for information on development, testing, and pull requests.

## 🤝 Acknowledgments

<!-- TODO: Refine acknowledgements as they develop -->

We would like to acknowledge the following individuals and entities for their contributions and inspiration to this project and the broader Algorand ecosystem:

- **Architectural Vision**: [Algorand Foundation](https://github.com/algorandfoundation) and [Bruno Martins](https://github.com/bmartins) (@bmartins) for his role as an Architect.
- **use-wallet**: [TxnLab](https://github.com/TxnLab) and [Doug Richar](https://github.com/drichar) (@drichar), along with [Gabriel Kuettel](https://github.com/gabrielkuettel) (@gabrielkuettel) (currently at Algorand Foundation), for their role in building the `use-wallet` hook.
- **Ecosystem Support**: The Engineering Teams at [Algorand Foundation](https://github.com/algorandfoundation) ranging from AlgoKit, Engineering, and Devrel for their role in providing ecosystem libraries and support.
- **Wallets**:
  - [Pera](https://github.com/perawallet) and [Will Beaumount](https://github.com/mjbeau) (@mjbeau) for their role in the ecosystem as a wallet and the large refactor to React Native.
  - [Akita](https://akita.community/) for their role in ARC58 adoption. With special thanks to Algorand Foundation engineering to [Kyle](https://github.com/kylebeee)(@kylebee) and [Joe Polny](https://github.com/joe-p)(@joe-p) for their contributions to the ARC58 plugin standards.
  - [Lute](https://lute.app) and [Andrew Funk](https://github.com/acfunk) (@acfunk) for their contributions to web wallets, readily adopting the latest features.
  - [Kibis-is](https://kibis.is/) and [Kieran Roneill](https://github.com/kieranroneill) (@kieranroneill) for their work as an extension-based wallet and contributions to ARC standards such as ARC27.
  - [Defly](https://defly.app/) and [Kevin Wellenzohn](https://github.com/k13n) (@k13n) for pioneering wallet features and deep engagement with the Algorand ecosystem and ARC standards.
