[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / extendNamespace

# Function: extendNamespace()

```ts
function extendNamespace<N extends never>(
  provider: NamespaceHost,
  namespace: N,
  surface: Contribution<Namespaces[N]>,
): { [K in never]: Namespaces[N] };
```

Defined in: [src/namespace.ts:448](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L448)

Builds the object an extension returns to add its surface to a namespace:
`{ [namespace]: group }`, where `group` is a copy of `provider[namespace]`
with `surface` deep-merged in. Nothing is mutated, so every surface
mounted before this one survives.

Two kinds of value take part:

- A **group** is a plain object (`{}` or `Object.create(null)`) whose
  members are all data. Groups merge.
- A **leaf** is anything else: a store, a class instance, an array, an
  object with a method or getter. A leaf is placed as is and can neither
  be merged into nor replaced.

Rules:

- **The root must be a group.** `provider[namespace]` is merged into when
  it is a plain object and starts empty when missing. A class instance (or
  `Map`, array) there throws a `MountError`. Keep state in a store leaf
  (`key.store`), not on the namespace object.
- **A group is data only.** One function or getter makes the whole object
  a leaf: after `{ hardware: { ledger, list() {} } }`, a later
  `{ hardware: { trezor } }` throws. Put helpers on a leaf beneath the
  group (`key.hardware.ledger`).
- **Groups are frozen.** `provider.key.hardware = …` throws a `TypeError`,
  at the root and in nested groups. To add to a namespace, call this
  function again. Leaves are never frozen. The lock is runtime-only:
  `Namespaces[N]` is not typed `Readonly`.
- **Getters stay live.** Members are copied by property descriptor, so a
  getter is mounted as a getter, not read once. A getter is a leaf.
- **Read the namespace lazily.** Each call returns a new copy, so a
  `provider.key` captured while an extension runs misses what later
  extensions add. Read `provider.key` at call time; leaves
  (`provider.key.store`) are safe to keep.

## Type Parameters

| Type Parameter        | Description                    |
| --------------------- | ------------------------------ |
| `N` _extends_ `never` | The registered namespace name. |

## Parameters

| Parameter   | Type                                                                                                                                                                                                                                        | Description                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `provider`  | [`NamespaceHost`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/NamespaceHost.md)                                                                                                                       | The provider the extension is being applied to. |
| `namespace` | `N`                                                                                                                                                                                                                                         | The namespace to extend (e.g. `"key"`).         |
| `surface`   | [`Contribution`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/type-aliases/Contribution.md)\<[`Namespaces`](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/interfaces/Namespaces.md)\[`N`\]\> | The branch this extension contributes.          |

## Returns

`{ [K in never]: Namespaces[N] }`

The object to return (or spread into) from the extension.

## Throws

If `surface` places a value on a mounted leaf
(`key.store` twice), descends into a leaf as if it were a group, or
`provider[namespace]` is a leaf rather than a group.

## Example

```typescript
export const WithKeyStore: Extension<KeyStoreExtension> = (provider, options) => {
  const store = options.keystore?.store;
  if (!store) throw new Error("WithKeyStore requires options.keystore.store");
  return {
    ...extendNamespace(provider, "key", { store: createKeyStore({ store, owner: pkg.name }) }),
    get keys() {
      return store.state.keys;
    },
  };
};

// A Ledger joining a provider that already has `key.store`:
extendNamespace(provider, "key", { hardware: { ledger } });
// => { key: { store, hardware: { ledger } } }
```
