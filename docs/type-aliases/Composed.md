[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Composed

# Type Alias: Composed\<T\>

```ts
type Composed<T> = { [K in keyof T]: T[K] } & object;
```

Defined in: [src/types.ts:174](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L174)

Flattens an intersection into a single object type for display.

Applied to a composed provider it makes hovers/quick-info print ONE object
listing every member: the [Provider](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md) core (`id`, `name`, …), each
namespace an extension contributes (`connection`, `account`, `identity`,
`key`, …), and any state an extension adds to the global surface (reactive
getters print as `readonly` properties). The flatten is shallow: namespace
APIs keep their named types.

## Type Parameters

| Type Parameter | Description                                   |
| -------------- | --------------------------------------------- |
| `T`            | The intersection (or object type) to flatten. |
