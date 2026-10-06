[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / compareBytes

# Function: compareBytes()

```ts
function compareBytes(a: Uint8Array, b: Uint8Array): number;
```

Defined in: [src/crypto.ts:34](https://github.com/algorandfoundation/wallet-provider/blob/main/src/crypto.ts#L34)

Compares two byte arrays lexicographically.
Returns negative if a < b, positive if a > b, zero if equal.
Used for deterministic ordering in ECDH.

## Parameters

| Parameter | Type         | Description        |
| --------- | ------------ | ------------------ |
| `a`       | `Uint8Array` | First Uint8Array.  |
| `b`       | `Uint8Array` | Second Uint8Array. |

## Returns

`number`

A number indicating the relative order of the arrays.
