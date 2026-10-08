[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / BaseProvider

# Type Alias: BaseProvider\<E _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) = `any`[]\>

```ts
type BaseProvider<E extends Extensions = any[]> = Composed<Provider & InferExtensions<E>>;
```

Defined in: [src/types.ts:210](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L210)

Type helper for a [Provider](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md) instance that has been augmented with [extensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extension.md).

The type is the [flattened](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Composed.md) merge of the [Provider](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md)
class and every surface the extensions declare as their return type, so
hovers/quick-info print a single object (core provider fields, the
extension namespaces, and any extension-added global state) instead of an
intersection chain or the extensions tuple.

The `options` property is the single [ExtensionOptions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md) registry,
the interface every extension module augments with its `options.<domain>`
namespace, so it renders as one compact named type.

## Type Parameters

| Type Parameter                                                                                                                | Default type | Description                                      |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------ |
| `E` _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) | `any`[]      | The array of extensions applied to the provider. |
