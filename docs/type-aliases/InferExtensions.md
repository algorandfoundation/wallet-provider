[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / InferExtensions

# Type Alias: InferExtensions\<E _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md)\>

```ts
protected type InferExtensions<E extends Extensions> = UnionToIntersection<ExtractExtensionReturn<E[number]>>;
```

Defined in: [src/types.ts:159](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L159)

Infers the combined return type of an array of [extensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extension.md).

## Type Parameters

| Type Parameter                                                                                                                | Description              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `E` _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) | The array of extensions. |
