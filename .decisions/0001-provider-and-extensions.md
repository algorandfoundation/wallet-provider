# ADR 1: Provider and Extensions Architecture

## Status

Proposal

## Context

The Algorand ecosystem requires a unified way to interact with various wallets. Existing solutions often lead to fragmented implementations or tight coupling with specific wallet providers. We need an abstraction that is flexible enough to accommodate different wallet capabilities while providing a consistent interface for developers.

## Decision

We have decided to use a **Provider** and **Extensions** architecture.

### Provider
The `Provider` is a base class that represents a wallet's identity (id, name, icon) and core configuration. It acts as the orchestrator for applying extensions.

### Extensions
Extensions are modular functions that augment the `Provider` instance with specific capabilities. This composition-based approach allows:
- **Decoupling**: Core logic remains slim, while specialized features (account management, signing, API integrations) are moved to extensions.
- **Interoperability**: Different wallets can implement the same set of extensions to provide a consistent experience.
- **Customization**: Developers can pick and choose only the extensions they need.

## Consequences

### Limited Concrete Examples
This project deliberately provides limited concrete examples of extensions. This is because:
1. **Community-Driven**: The success of this abstraction relies on the community coming together to define and implement extensions that meet real-world needs.
2. **Organic Growth**: We favor organic growth over a top-down, prescriptive approach. By providing the base `Provider` and a few "getting started" extensions (like logging or mock accounts), we enable the ecosystem to develop its own standards and specialized plugins.
3. **Flexibility**: Avoiding over-specification early on allows the architecture to evolve based on actual usage patterns within the Algorand community.

### Ecosystem Contribution
While some baseline extensions will be provided to demonstrate the pattern, we strongly encourage wallet developers and ecosystem contributors to create and maintain their own extensions. This ensures that the provider remains a neutral foundation for all.

See [Extensions](https://github.com/algorandfoundation/wallet-provider-extensions) for more details about concrete extension interfaces.