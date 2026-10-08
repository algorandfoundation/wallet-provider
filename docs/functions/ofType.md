[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / ofType

# Function: ofType()

```ts
function ofType<T extends string>(type: T): <E>(entry: E) => entry is Extract<E, { type: T }>;
```

Defined in: [src/namespace.ts:231](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L231)

A predicate that matches the entries of one domain kind: those whose
[Entity.type](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/Entity.md#property-type) equals `type`. Exact match only.

The predicate narrows a union entry type to the members with that `type`,
so the domain-level fields of that kind are typed after a `filter` or
`find`. Compose with [ownedBy](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/functions/ownedBy.md) to narrow both axes.

## Type Parameters

| Type Parameter         | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `T` _extends_ `string` | The domain kind. A literal when written inline or declared `as const`. |

## Parameters

| Parameter | Type | Description                 |
| --------- | ---- | --------------------------- |
| `type`    | `T`  | The kind, e.g. `"ed25519"`. |

## Returns

Whether an entry is of that kind.

\<`E`\>(`entry`: `E`) => `entry is Extract<E, { type: T }>`

## Example

```typescript
const eds = store.state.keys.filter(ofType("ed25519"));
eds[0]?.publicKey; // typed from the `ed25519` member of `KeyEntry`
```
