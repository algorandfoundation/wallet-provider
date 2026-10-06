[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Provider

# Class: Provider\<_E _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) = [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md)\>

Defined in: [src/types.ts:223](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L223)

Base class for managing configurations and extensions dynamically.

The `Provider` class represents a wallet's identity and core configuration.
It can be extended with [extensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extension.md) to add specific capabilities.

## Example

```typescript
// 1. Define an extension
const withLogger: Extension<{ log: (msg: string) => void }> = (provider) => ({
  log: (msg) => console.log(`[${provider.name}] ${msg}`),
});

// 2. Create a specialized Provider class
const MyProvider = Provider.withExtensions([withLogger]);

// 3. Instantiate the provider
const wallet = new MyProvider({ id: "p1", name: "My Wallet" });

// 4. Use the extension functionality
wallet.log("Initialized!");
```

## Type Parameters

| Type Parameter                                                                                                                 | Default type                                                                                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_E` _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) | [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) | The array of extensions applied to this provider. Phantom on the instance side (defaulted to [Extensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md), so bare `Provider` is a legal annotation and displays as `Provider<Extensions>`); the tuple only matters for the `EXTENSIONS` static tied by [withExtensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#withextensions). |

## Constructors

### Constructor

```ts
new Provider<_E extends Extensions = Extensions>(config: ProviderOptions, options?: any): Provider<_E>;
```

Defined in: [src/types.ts:280](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L280)

Constructs a new Provider instance.

It merges the provided `options` with [DEFAULTS](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#property-defaults) and applies all [EXTENSIONS](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#property-extensions)
to the instance, merging their return values into `this`.

#### Parameters

| Parameter  | Type                                                                                                                    | Description                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `config`   | [`ProviderOptions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ProviderOptions.md) | Core metadata for the provider.              |
| `options?` | `any`                                                                                                                   | Custom configuration options for extensions. |

#### Returns

`Provider`\<`_E`\>

#### Remarks

The `options` parameter is deliberately left untyped here (`ExtensionOptions | any`
collapses to `any`). The base class is the seat of the _concrete-class pattern_,
`class MyWallet extends Provider { … }`, where a subclass owns its own option
shape and applies extensions imperatively, so the base constructor must accept any
bag without forcing every subclass to augment the [ExtensionOptions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md)
registry first.

[withExtensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#withextensions) is the **single typed overload**: the class it returns
drops this loose construct signature and types `options` as the
[ExtensionOptions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md) registry, so at a composition root an unregistered
`options.<domain>` block is a compile error rather than an `any` fallback.
Prefer `Provider.withExtensions([...])` whenever the options should be checked.

#### Throws

If an extension returns a Promise. Extensions are
applied synchronously; async extensions are not supported (yet), so the
constructor fails fast instead of silently discarding the resolved surface.

## Properties

| Property                                      | Modifier | Type                                                                                                                      | Default value | Description                                                                                                                                                                                                                                    | Defined in                                                                                            |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| <a id="property-icon"></a> `icon?`            | `public` | `string`                                                                                                                  | `undefined`   | Optional icon for the provider.                                                                                                                                                                                                                | [src/types.ts:229](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L229) |
| <a id="property-id"></a> `id`                 | `public` | `string`                                                                                                                  | `undefined`   | Unique identifier for the provider instance.                                                                                                                                                                                                   | [src/types.ts:225](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L225) |
| <a id="property-name"></a> `name`             | `public` | `string`                                                                                                                  | `undefined`   | Human-readable name of the provider.                                                                                                                                                                                                           | [src/types.ts:227](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L227) |
| <a id="property-options"></a> `options`       | `public` | [`ExtensionOptions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md) | `undefined`   | Merged configuration options for the provider and its extensions.                                                                                                                                                                              | [src/types.ts:240](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L240) |
| <a id="property-uri"></a> `uri?`              | `public` | `string` \| `URL`                                                                                                         | `undefined`   | Sharable Provider URI. Can be used for deep linking (e.g., `wallet://perawallet.app/onboard?extensions=[...]`).                                                                                                                                | [src/types.ts:235](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L235) |
| <a id="property-defaults"></a> `DEFAULTS`     | `static` | `object`                                                                                                                  | `{}`          | Default options for the Provider class.                                                                                                                                                                                                        | [src/types.ts:245](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L245) |
| <a id="property-extensions"></a> `EXTENSIONS` | `static` | [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md)           | `[]`          | Extensions to be applied to all instances of this Provider class. Use [withExtensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#withextensions) to create a subclass with specific extensions. | [src/types.ts:251](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L251) |

## Methods

### withExtensions()

```ts
static withExtensions<E extends Extensions>(extensions: E): {
(config: ProviderOptions, options?: ExtensionOptions): { [K in string | number | symbol]: (Provider<Extensions> & UnionToIntersection<ExtractExtensionReturn<E[number]>>)[K] };
  EXTENSIONS: E;
} & Omit<typeof Provider, never>;
```

Defined in: [src/types.ts:341](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L341)

Creates a new Provider class that includes the specified extensions.

This method uses composition to augment the Provider class with additional functionality
defined by the extensions.

Instances of the returned class are typed as [BaseProvider](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/BaseProvider.md)`<E>`, the
[flattened](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Composed.md) merge of the Provider core and every extension
surface, so hovers print one object with every namespace and
extension-added property visible, rather than an intersection chain or the
extensions tuple.

The options get the same treatment: the constructor's `options` parameter
(and the instance's `options` property) is the single
[ExtensionOptions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md) registry, the interface every extension module
augments with its `options.<domain>` block, so each registered
options block is fully typed at the call site while the property renders as
one compact named type.

The type parameter is `const`, so a heterogeneous array literal keeps
its tuple type (no `as const` at the call site) and every extension's
surface reaches the instance type instead of collapsing to `Extension[]`.

#### Type Parameters

| Type Parameter                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------- |
| `E` _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) |

#### Parameters

| Parameter    | Type | Description                                                                                                                        |
| ------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `extensions` | `E`  | An array of [Extension](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extension.md) functions. |

#### Returns

\{
(`config`: [`ProviderOptions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ProviderOptions.md), `options?`: [`ExtensionOptions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md)): \{ \[K in string \| number \| symbol\]: (Provider\<Extensions\> & UnionToIntersection\<ExtractExtensionReturn\<E\[number\]\>\>)\[K\] \};
`EXTENSIONS`: `E`;
\} & `Omit`\<_typeof_ `Provider`, `never`\>

A new Provider subclass with the extensions applied.

#### Example

```typescript
const EnhancedProvider = Provider.withExtensions([authExtension, txnExtension]);
const provider = new EnhancedProvider({ id: "id", name: "name" });
```
