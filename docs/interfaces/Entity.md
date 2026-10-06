[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Entity

# Interface: Entity\<Type _extends_ `string` = `string`, Metadata _extends_ `object` = `Record`\<`string`, `unknown`\>, Owner _extends_ `string` = `string`\>

Defined in: [src/namespace.ts:121](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L121)

The shape every entry of a domain store shares: what it is, who wrote it,
and the writer's own data. Operations are attached later by [hydrate](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/functions/hydrate.md).

The two tags are different axes and both are needed. `type` is the
domain's vocabulary (`"ed25519"`, `"algorand"`) and decides the
domain-level fields an entry carries (a public key, an address); the
package that owns the domain declares them. `owner` is the writing
package's name and decides what `metadata` holds (a derivation index, a
BIP-32 path); the writer declares it on the [Owners](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/Owners.md) registry. Two
packages can write the same `type`, and one package can write dozens of
them, so neither tag can stand in for the other.

The `owner` value is the package name, unique by construction and readable
in persisted data. Every writer tags, the local keystore included; there is
no reserved default. Core cannot discover the name at runtime, so the
package declares it once.

## Example

```typescript
// The keystore package owns the `type` axis and the domain-level fields:
interface KeyTypes {
  ed25519: { publicKey: Uint8Array };
  secp256k1: { publicKey: Uint8Array; compressed: boolean };
}
type KeyEntry = {
  [T in keyof KeyTypes]: Entity<T> & KeyTypes[T] & { id: string; sign?: Signer };
}[keyof KeyTypes];

// The Ledger package writes `{ type: "ed25519", owner: OWNER, metadata: { bip32Path }, ... }`.
```

## Type Parameters

| Type Parameter                | Default type                    | Description                                                                                                                                                      |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Type` _extends_ `string`     | `string`                        | The domain kind, a string literal union in a domain's entry type.                                                                                                |
| `Metadata` _extends_ `object` | `Record`\<`string`, `unknown`\> | The writer's data. Defaults to an open record; narrowed by [ownedBy](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/functions/ownedBy.md). |
| `Owner` _extends_ `string`    | `string`                        | The writing package's name. Stays `string` in a domain's entry type.                                                                                             |

## Properties

| Property                                  | Type       | Description                                                                                  | Defined in                                                                                                    |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| <a id="property-metadata"></a> `metadata` | `Metadata` | The writer's own data. Only the owner reads it; core never looks inside.                     | [src/namespace.ts:131](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L131) |
| <a id="property-owner"></a> `owner`       | `Owner`    | The name of the package that wrote this entry, e.g. `"@algorandfoundation/keystore-ledger"`. | [src/namespace.ts:129](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L129) |
| <a id="property-type"></a> `type`         | `Type`     | The domain kind, e.g. `"ed25519"`. Set by the domain, not by the writer.                     | [src/namespace.ts:127](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L127) |
