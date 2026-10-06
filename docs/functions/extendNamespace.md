[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / extendNamespace

# Function: extendNamespace()

```ts
function extendNamespace<N extends never>(
  provider: NamespaceHost,
  namespace: N,
  surface: Contribution<Namespaces[N]>,
): { [K in never]: Namespaces[N] };
```

Defined in: [src/namespace.ts:418](https://github.com/algorandfoundation/wallet-provider/blob/main/src/namespace.ts#L418)

Builds the object an extension returns to add its surface to a namespace:
`{ [namespace]: group }`, where `group` is a copy of `provider[namespace]`
with `surface` deep-merged in.

Plain objects on both sides are groups and merge; anything else (a
keystore, a class instance, an object with methods) is a leaf and is
placed as is. Existing objects are never mutated, so every surface mounted
before this one survives, and every consumer reading `provider.key` finds
them all.

Three rules follow and are part of the contract:

- **A group is data only.** An object is a group only if every member is a
  plain data value. One function or getter/setter makes the whole object a
  leaf, so `{ hardware: { ledger, list() {} } }` mounts `key.hardware` as a
  surface and a later `{ hardware: { trezor } }` throws. Keep groups free
  of behavior; put helpers on a leaf beneath them (`key.hardware.ledger`).
- **Getters stay live.** Members are copied by property descriptor, so a
  getter in `surface` (or already in the group) is mounted as a getter,
  never read once and frozen. A getter is a leaf: it can be placed but not
  merged into or replaced.
- **Read the namespace lazily.** Every call returns a new copy of the
  group, so a reference to `provider.key` captured while an extension runs
  does not see what later extensions add. Read `provider.key` at call time
  instead of keeping it; leaves (`provider.key.store`) are placed as is and
  are safe to keep.

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

If `surface` places a value where a leaf is already
mounted (`key.store` twice), or descends into a leaf as if it were a group.

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
