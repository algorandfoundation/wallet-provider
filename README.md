# Wallet Provider

<!-- TODO: Add Heading with badges -->

A modular, extensible wallet provider abstraction for the Algorand ecosystem. Inspired by the architecture of OctoKit and TxnLab's `use-wallet`, this package provides a base for building wallet integrations that can be dynamically extended with additional functionality.

### Provider

The `Provider` is the base class that represents a wallet's identity and core configuration. It manages:

- **Configuration**: Shared options for the provider and its extensions.
- **Composition**: Orchestrating the application of extensions.

### Extensions

Extensions are modular functions that augment the `Provider` with specific capabilities.

- **Responsibility**: Extensions handle domain-specific logic such as account management, transaction signing, or specific API integrations (e.g., Liquid, OIDC).
- **Flexibility**: They can be independent packages, provided by third parties, or baseline defaults (like KeyStore + BIP39).
- **Prefer Composition**: Use `withExtensions` to create specialized Provider classes with a fixed set of extensions.

## Usage

The following example demonstrates how to create a specialized provider with extensions and use it in your application.
See the [DISCOVERY](./DISCOVERY.md) document for a high level concept of what a Provider's shape may look like.
Read our [Architectural Decision Records (ADRs)](.decisions/0001-provider-and-extensions.md) for more context on the project's design.

```typescript
import {
  Provider,
  type Extension,
  type ProviderOptions,
} from "@algorandfoundation/wallet-provider";

// 1. Define an extension that adds logging capabilities
type LoggerExtension = { log: (msg: string) => void };
const withLogger: Extension<LoggerExtension> = (provider) => {
  return {
    log: (msg: string) => console.log(`[${provider.name}] ${msg}`),
  };
};

// 2. Define an extension that handles accounts (mock example)
type AccountExtension = { accounts: string[]; getAccounts: () => string[] };
const withAccounts: Extension<AccountExtension> = (provider, options) => {
  const accounts = options.accounts ? ["address1", "address2"] : [];
  return {
    accounts: accounts,
    getAccounts: () => accounts,
  };
};

// 3. Create a specialized Provider class with these extensions
const MyWalletProvider = Provider.withExtensions([withLogger, withAccounts]);

// 4. Instantiate the provider with metadata and options
const config: ProviderOptions = {
  id: "my-wallet",
  name: "My Wallet",
  icon: "https://example.com/icon.png",
};

const wallet = new MyWalletProvider(config, {
  accounts: true, // This option is passed to the extensions
});

// 5. Use the augmented functionality
wallet.log("Wallet initialized!");
const accounts = wallet.getAccounts();
console.log("Available accounts:", accounts);
```

## Acknowledgments

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

<!-- TODO: Add Stars/Forks Badge -->
