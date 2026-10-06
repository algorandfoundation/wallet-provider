[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Namespaces

# Interface: Namespaces

Defined in: [src/namespace.ts:52](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L52)

Registry of provider namespaces: a declaration-merged interface every
extension package augments with the namespace it mounts and the API type
that lives there.

Registering a namespace makes it a valid argument for
[extendNamespace](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/functions/extendNamespace.md) and types `provider.<namespace>` on every
`Extension`, so dependents read `provider.key?.store` directly.
Unregistered names are rejected at the call site.

## Example

```typescript
// In the keystore package, beside its `ExtensionOptions` registration:
declare module "@algorandfoundation/wallet-provider" {
  interface Namespaces {
    key: KeyStoreExtension["key"];
  }
}
```
