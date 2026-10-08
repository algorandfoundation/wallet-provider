[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Extension

# Type Alias: Extension\<T = `any`\>

```ts
type Extension<T = any> = (provider: NamespaceHost, options: ExtensionOptions) => T;
```

Defined in: [src/types.ts:39](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L39)

An Extension is a function that augments a [Provider](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md) instance with additional functionality.

Extensions are the primary way to add capabilities to a provider, such as account management,
transaction signing, or custom API integrations.

Both parameters are typed by the registries: `provider` is a
[NamespaceHost](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/NamespaceHost.md) (the core plus every namespace registered on
`Namespaces`, each optional), and `options` is the single
[ExtensionOptions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md) registry. Register your `options.<domain>` slice
and your `provider.<namespace>` via declaration merging and read them
directly; an unregistered name is a compile error.

## Type Parameters

| Type Parameter | Default type | Description                                                                                         |
| -------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `T`            | `any`        | The type of the object that the extension returns, which will be merged into the Provider instance. |

## Parameters

| Parameter  | Type                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `provider` | [`NamespaceHost`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/NamespaceHost.md)     |
| `options`  | [`ExtensionOptions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md) |

## Returns

`T`

## Example

```typescript
declare module "@algorandfoundation/wallet-provider" {
  interface ExtensionOptions {
    greeter?: { loud?: boolean };
  }
}
const myExtension: Extension<{ sayHello: () => void }> = (provider, options) => {
  const signer = provider.key?.store; // typed from `Namespaces["key"]`, undefined until mounted
  return {
    sayHello: () =>
      console.log(`Hello from ${provider.name}${options.greeter?.loud ? "!!!" : "!"}`),
  };
};
```
