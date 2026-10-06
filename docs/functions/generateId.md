[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / generateId

# Function: generateId()

```ts
function generateId(): string;
```

Defined in: [src/crypto.ts:5](https://github.com/algorandfoundation/wallet-provider/blob/main/src/crypto.ts#L5)

Generates a cryptographically secure random ID (hex string)
Uses the Web Crypto API's getRandomValues for secure randomness

## Returns

`string`
