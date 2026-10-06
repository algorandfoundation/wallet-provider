[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Owners

# Interface: Owners

Defined in: [src/namespace.ts:170](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L170)

Registry of writers: a declaration-merged interface every package that
writes entries augments with its own name and the `metadata` shape it
writes under that name.

Registering makes [ownedBy](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/functions/ownedBy.md) narrow `metadata` as well as `owner`, so
`store.state.keys.filter(ownedBy(OWNER))` types `metadata.bip32Path`
without a cast. Unregistered owners still match; their `metadata` stays
the open record the entry type declares.

The key has to be a literal for the narrowing to happen. A `package.json`
import types `name` as `string`, so declare the literal once and assert
it against `pkg.name` in a test.

## Example

```typescript
// In the Ledger package:
export const OWNER = "@algorandfoundation/keystore-ledger" as const;

declare module "@algorandfoundation/wallet-provider" {
  interface Owners {
    [OWNER]: { deviceId: string; bip32Path: string };
  }
}
```
