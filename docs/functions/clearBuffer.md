[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / clearBuffer

# Function: clearBuffer()

```ts
function clearBuffer(data?: Uint8Array<ArrayBufferLike>): void;
```

Defined in: [src/crypto.ts:19](https://github.com/algorandfoundation/wallet-provider/blob/main/src/crypto.ts#L19)

Securely clears sensitive data from memory by overwriting with zeros.
Use this after cryptographic operations to minimize key exposure.

## Parameters

| Parameter | Type                              | Description                                          |
| --------- | --------------------------------- | ---------------------------------------------------- |
| `data?`   | `Uint8Array`\<`ArrayBufferLike`\> | The Uint8Array to clear. If undefined, does nothing. |

## Returns

`void`
