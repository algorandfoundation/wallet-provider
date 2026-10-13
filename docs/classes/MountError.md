[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / MountError

# Class: MountError

Defined in: [src/namespace.ts:81](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L81)

Thrown when a surface cannot be mounted. From `extendNamespace`: the
contribution places a value where one is already mounted, or descends into
a mounted surface as if it were a group. From the `Provider` constructor:
an extension returns a property the provider already has (a core field or
one an earlier extension mounted) instead of extending it.

## Extends

- `Error`

## Constructors

### Constructor

```ts
new MountError(message: string): MountError;
```

Defined in: [src/namespace.ts:82](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L82)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `message` | `string` |

#### Returns

`MountError`

#### Overrides

```ts
Error.constructor;
```

## Properties

| Property                                | Type      | Inherited from  | Defined in                                                                                 |
| --------------------------------------- | --------- | --------------- | ------------------------------------------------------------------------------------------ |
| <a id="property-cause"></a> `cause?`    | `unknown` | `Error.cause`   | node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:24 |
| <a id="property-message"></a> `message` | `string`  | `Error.message` | node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1075        |
| <a id="property-name"></a> `name`       | `string`  | `Error.name`    | node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1074        |
| <a id="property-stack"></a> `stack?`    | `string`  | `Error.stack`   | node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1076        |
