[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / Provider

# Class: Provider\<_E _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) = [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md)\>

Defined in: [src/types.ts:285](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L285)

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

Defined in: [src/types.ts:370](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L370)

Constructs a new Provider instance.

It merges the provided `options` over [DEFAULTS](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#property-defaults) and applies all [EXTENSIONS](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#property-extensions)
to the instance, merging their return values into `this`.

The options merge goes one `options.<domain>` block deep: a block
present on both sides is merged key by key, so a caller overriding one
field keeps the defaults for the rest, and every plain block from
`DEFAULTS` is copied, so instances never share the static's objects.
Values that are not plain objects (an injected `Store`, a transport) are
passed through by reference.

Extensions apply in order and each one adds to the instance; none may
redefine what is already there. A core field (`id`, `name`, `icon`,
`uri`, `port`, `ssl`, `options`) or a property an earlier extension
mounted is a collision and throws. The one legitimate overlap is a
namespace several extensions share: a group built with `extendNamespace`
from the current `provider.<namespace>` replaces it, carrying every
surface mounted before.

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

If an extension returns a Promise (extensions are
applied synchronously; async extensions are not supported yet, so the
constructor fails fast instead of silently discarding the resolved
surface) or anything that is not an object (return `{}` to contribute
nothing).

#### Throws

If an extension returns a property the provider
already has (a core field such as `id` or `options`, or a property an
earlier extension mounted), other than a namespace extended with
`extendNamespace`.

## Properties

| Property                                      | Modifier | Type                                                                                                                      | Default value | Description                                                                                                                                                                                                                                               | Defined in                                                                                            |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| <a id="property-icon"></a> `icon?`            | `public` | `string`                                                                                                                  | `undefined`   | Optional icon for the provider.                                                                                                                                                                                                                           | [src/types.ts:291](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L291) |
| <a id="property-id"></a> `id`                 | `public` | `string`                                                                                                                  | `undefined`   | Unique identifier for the provider instance.                                                                                                                                                                                                              | [src/types.ts:287](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L287) |
| <a id="property-name"></a> `name`             | `public` | `string`                                                                                                                  | `undefined`   | Human-readable name of the provider.                                                                                                                                                                                                                      | [src/types.ts:289](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L289) |
| <a id="property-options"></a> `options`       | `public` | [`ExtensionOptions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md) | `undefined`   | Merged configuration options for the provider and its extensions.                                                                                                                                                                                         | [src/types.ts:306](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L306) |
| <a id="property-port"></a> `port?`            | `public` | `number`                                                                                                                  | `undefined`   | Optional port the provider communicates over.                                                                                                                                                                                                             | [src/types.ts:299](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L299) |
| <a id="property-ssl"></a> `ssl?`              | `public` | `boolean`                                                                                                                 | `undefined`   | Whether the provider communicates over SSL.                                                                                                                                                                                                               | [src/types.ts:301](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L301) |
| <a id="property-uri"></a> `uri?`              | `public` | `string` \| `URL`                                                                                                         | `undefined`   | Sharable Provider URI. Can be used for deep linking (e.g., `wallet://perawallet.app/onboard?extensions=[...]`).                                                                                                                                           | [src/types.ts:297](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L297) |
| <a id="property-defaults"></a> `DEFAULTS`     | `static` | `Record`\<`string`, `unknown`\>                                                                                           | `{}`          | Default options for the Provider class, merged under the `options` the constructor receives one `options.<domain>` block at a time (see the constructor). Plain blocks are copied per instance; anything else (an injected store) is shared by reference. | [src/types.ts:314](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L314) |
| <a id="property-extensions"></a> `EXTENSIONS` | `static` | [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md)           | `[]`          | Extensions to be applied to all instances of this Provider class. Use [withExtensions](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md#withextensions) to create a subclass with specific extensions.            | [src/types.ts:320](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L320) |

## Methods

### withExtensions()

```ts
static withExtensions<E extends Extensions, P extends Extensions = Extensions>(this: object, extensions: E): {
(config: ProviderOptions, options?: ExtensionOptions): { [K in string | number | symbol]: (Provider<Extensions> & UnionToIntersection<ExtractExtensionReturn<ChainedExtensions<P, E>[number]>>)[K] };
  EXTENSIONS: ChainedExtensions<P, E>;
} & Omit<typeof Provider, "EXTENSIONS">;
```

Defined in: [src/types.ts:472](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L472)

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

Calls chain. On a class that already has extensions, the result applies
those first and the new ones after, and its type is the
[concatenated tuple](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/ChainedExtensions.md), so a base wallet class can
be specialized step by step. The resulting `EXTENSIONS` is a new array:
the lists of the classes it was built from are never mutated.

#### Type Parameters

| Type Parameter                                                                                                                | Default type                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `E` _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) | -                                                                                                               |
| `P` _extends_ [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) | [`Extensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extensions.md) |

#### Parameters

| Parameter         | Type                     | Description                                                                                                                        |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `this`            | \{ `EXTENSIONS`: `P`; \} | -                                                                                                                                  |
| `this.EXTENSIONS` | `P`                      | -                                                                                                                                  |
| `extensions`      | `E`                      | An array of [Extension](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Extension.md) functions. |

#### Returns

\{
(`config`: [`ProviderOptions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ProviderOptions.md), `options?`: [`ExtensionOptions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/ExtensionOptions.md)): \{ \[K in string \| number \| symbol\]: (Provider\<Extensions\> & UnionToIntersection\<ExtractExtensionReturn\<ChainedExtensions\<P, E\>\[number\]\>\>)\[K\] \};
`EXTENSIONS`: [`ChainedExtensions`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/ChainedExtensions.md)\<`P`, `E`\>;
\} & `Omit`\<_typeof_ `Provider`, `"EXTENSIONS"`\>

A new Provider subclass with the extensions applied.

#### Example

```typescript
const EnhancedProvider = Provider.withExtensions([authExtension, txnExtension]);
const provider = new EnhancedProvider({ id: "id", name: "name" });

// Chained: applies authExtension, txnExtension, then ledgerExtension.
const HardwareProvider = EnhancedProvider.withExtensions([ledgerExtension]);
```
