[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Owned

# Interface: Owned

Defined in: [src/namespace.ts:139](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L139)

The one field [ownedBy](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/functions/ownedBy.md) needs: an entry tagged with the package that
wrote it. Every [Entity](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/Entity.md) is `Owned`; the narrower trait is kept for
predicates and for entries that predate `type` and `metadata`.

## Properties

| Property                            | Type     | Description                                                                                  | Defined in                                                                                                    |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| <a id="property-owner"></a> `owner` | `string` | The name of the package that wrote this entry, e.g. `"@algorandfoundation/keystore-ledger"`. | [src/namespace.ts:141](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L141) |
