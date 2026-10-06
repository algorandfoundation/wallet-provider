[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Extensions

# Type Alias: Extensions

```ts
type Extensions = readonly Extension[];
```

Defined in: [src/types.ts:49](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L49)

A readonly list of [extensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extension.md): the constraint (and
default) for the extensions seat across [Provider](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md),
[BaseProvider](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/BaseProvider.md), and [Provider.withExtensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#withextensions).

Naming the list keeps annotations readable: a bare `Provider` displays as
`Provider<Extensions>` instead of echoing a resolved tuple of function
signatures.
