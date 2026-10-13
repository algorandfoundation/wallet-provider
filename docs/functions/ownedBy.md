[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / ownedBy

# Function: ownedBy()

```ts
function ownedBy<O extends string>(owner: O): <E>(entry: E) => entry is E & OwnedBy<O>;
```

Defined in: [src/namespace.ts:207](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L207)

A predicate that matches the entries a package owns: those whose
[Owned.owner](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/Owned.md#property-owner) equals `owner`. Exact match only.

Every package hydrates and writes only the entries it owns, so a key list
has one writer per key.

The predicate narrows. Given a literal owner it types the match as the
entry with that `owner`, and, when the owner is registered on
[Owners](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/Owners.md), with that owner's `metadata`. A `string` owner matches the
same entries and narrows nothing.

## Type Parameters

| Type Parameter         | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `O` _extends_ `string` | The owner name. A literal when declared `as const`. |

## Parameters

| Parameter | Type | Description                     |
| --------- | ---- | ------------------------------- |
| `owner`   | `O`  | The package name, e.g. `OWNER`. |

## Returns

Whether an entry belongs to that package.

\<`E`\>(`entry`: `E`) => `entry is E & OwnedBy<O>`

## Example

```typescript
const mine = store.state.keys.filter(ownedBy(OWNER));
mine[0]?.metadata.bip32Path; // typed from `Owners[typeof OWNER]`
```
