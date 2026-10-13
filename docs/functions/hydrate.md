[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / hydrate

# Function: hydrate()

```ts
function hydrate<T extends object, Ops extends object>(entry: T, ops: Ops): T & Readonly<Ops>;
```

Defined in: [src/namespace.ts:272](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L272)

Attaches operations to an entry as non-enumerable, read-only properties.

Entries live in a reactive store and travel through bridges, so they stay
data. The functions are re-attached in memory after every store change and
are invisible to `JSON.stringify`, `structuredClone` and object spread.
Operations the entry already has as own properties are left alone, so the
call is idempotent and safe to run on every emit. Inherited names (such as
`toString`) do not count: an operation with that name is attached.

## Type Parameters

| Type Parameter           | Description               |
| ------------------------ | ------------------------- |
| `T` _extends_ `object`   | The entry.                |
| `Ops` _extends_ `object` | The operations to attach. |

## Parameters

| Parameter | Type  | Description                                          |
| --------- | ----- | ---------------------------------------------------- |
| `entry`   | `T`   | The entry to hydrate. Mutated in place and returned. |
| `ops`     | `Ops` | The operations, keyed by name.                       |

## Returns

`T` & `Readonly`\<`Ops`\>

The same entry, typed with the operations as read-only members.

The entry type declares its operations as optional properties, so a read
needs no cast and reflects that an entry may not be hydrated yet.

## Example

```typescript
interface KeyEntry extends Entity<"ed25519"> {
  id: string;
  sign?: (bytes: Uint8Array) => Uint8Array; // filled by hydration
}

store.subscribe((state) => {
  if (state.status !== "ready") return;
  for (const key of state.keys.filter(ownedBy(OWNER))) {
    hydrate(key, { sign: (bytes: Uint8Array) => ledger.sign(key.id, bytes) });
  }
});
```
