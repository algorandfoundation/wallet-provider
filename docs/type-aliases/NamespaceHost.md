[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / NamespaceHost

# Type Alias: NamespaceHost

```ts
type NamespaceHost = Provider & Partial<Namespaces>;
```

Defined in: [src/namespace.ts:63](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L63)

The provider as an extension sees it while it is being built: the core
plus every registered namespace, each optional because the extension that
mounts it may not have run yet.
