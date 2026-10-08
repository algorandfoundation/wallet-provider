[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / ChainedExtensions

# Type Alias: ChainedExtensions\<P _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md), E _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md)\>

```ts
type ChainedExtensions<P extends Extensions, E extends Extensions> = number extends P["length"]
  ? E
  : readonly [...P, ...E];
```

Defined in: [src/types.ts:174](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L174)

The extensions a class built by [Provider.withExtensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#withextensions) applies:
the extensions of the class it was called on, followed by the new ones.

Only a tuple parent contributes to the type. The base class's open list
(`Extensions`, no fixed length) is empty at runtime and contributes
nothing, so a first `withExtensions` call keeps the tuple it was given.

## Type Parameters

| Type Parameter                                                                                                                | Description                                                   |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `P` _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) | The `EXTENSIONS` of the class `withExtensions` was called on. |
| `E` _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) | The extensions passed to `withExtensions`.                    |
