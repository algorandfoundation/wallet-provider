[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / OwnedBy

# Type Alias: OwnedBy\<O _extends_ `string`\>

```ts
type OwnedBy<O extends string> = O extends keyof Owners ? object : object;
```

Defined in: [src/namespace.ts:178](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L178)

What [ownedBy](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/functions/ownedBy.md) adds to an entry it matched: the owner literal and, for
a registered owner, that owner's `metadata` shape.

## Type Parameters

| Type Parameter         | Description                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `O` _extends_ `string` | The owner name passed to [ownedBy](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/functions/ownedBy.md). |
