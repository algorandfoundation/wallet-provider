[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Contribution

# Type Alias: Contribution\<T\>

```ts
type Contribution<T> = T extends object ? { [K in keyof T]?: Contribution<T[K]> } : T;
```

Defined in: [src/namespace.ts:71](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L71)

The part of a registered surface one extension contributes: a deep partial
of `Namespaces[N]`, so a package can add one branch (`{ hardware: { ledger } }`)
without providing the rest.

## Type Parameters

| Type Parameter | Description                  |
| -------------- | ---------------------------- |
| `T`            | The registered surface type. |
