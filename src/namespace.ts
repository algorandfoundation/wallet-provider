/**
 * Shared provider namespaces for extensions.
 *
 * Every domain has one fixed namespace on the provider (`provider.key`,
 * `provider.account`, ...). The package that owns the domain registers it
 * once on the {@link Namespaces} registry with the API type it mounts, the
 * same way `options.<domain>` is registered on `ExtensionOptions`. From then
 * on the name is known to the compiler: a typo is a compile error and the
 * result of a lookup is typed.
 *
 * Extensions extend a namespace, they never replace it. A second extension
 * returning a fresh `key` object would shadow the first one's, so
 * {@link extendNamespace} deep-merges the extension's surface into a copy of
 * the group that is already there: the local keystore lands at `key.store`,
 * a Ledger beside it at `key.hardware.ledger`, and both survive. Dependents
 * read `provider.<namespace>` directly while the provider is being built;
 * the `Extension` signature ({@link NamespaceHost}) types it from the
 * registry.
 *
 * One domain, one store. However many surfaces share a namespace, they all
 * read and write `options.<domain>.store`, so `provider.keys` stays a single
 * list. Every package tags what it writes with its own name
 * ({@link Owned.owner}) and hydrates only what it owns: {@link ownedBy} picks
 * its entries, {@link hydrate} attaches the operations after every store
 * change.
 */

import type { Provider } from "./types.ts";

/**
 * Registry of provider namespaces: a declaration-merged interface every
 * extension package augments with the namespace it mounts and the API type
 * that lives there.
 *
 * Registering a namespace makes it a valid argument for
 * {@link extendNamespace} and types `provider.<namespace>` on every
 * `Extension`, so dependents read `provider.key?.store` directly.
 * Unregistered names are rejected at the call site.
 *
 * @example
 * ```typescript
 * // In the keystore package, beside its `ExtensionOptions` registration:
 * declare module "@algorandfoundation/wallet-provider" {
 *   interface Namespaces {
 *     key: KeyStoreExtension["key"];
 *   }
 * }
 * ```
 */
export interface Namespaces {}

/** A registered namespace name. */
type Namespace = keyof Namespaces & string;

/**
 * The provider as an extension sees it while it is being built: the core
 * plus every registered namespace, each optional because the extension that
 * mounts it may not have run yet.
 */
export type NamespaceHost = Provider & Partial<Namespaces>;

/**
 * The part of a registered surface one extension contributes: a deep partial
 * of `Namespaces[N]`, so a package can add one branch (`{ hardware: { ledger } }`)
 * without providing the rest.
 *
 * @template T - The registered surface type.
 */
export type Contribution<T> = T extends object ? { [K in keyof T]?: Contribution<T[K]> } : T;

/**
 * Thrown when a namespace cannot be extended: the surface places a value
 * where one is already mounted, or descends into a mounted surface as if it
 * were a group.
 */
export class MountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MountError";
  }
}

/**
 * An entry in a domain's shared store, tagged with the package that wrote it.
 *
 * Every surface of a domain feeds the same store, so the tag is how a package
 * tells its own entries apart ({@link ownedBy}) and hydrates only those.
 * The value is the writing package's name, unique by construction and
 * readable in persisted data. Every writer tags, the local keystore included;
 * there is no reserved default. Core cannot discover the name at runtime, so
 * the package declares it once.
 *
 * @example
 * ```typescript
 * import pkg from "../package.json" with { type: "json" };
 *
 * interface KeyEntry extends Owned {
 *   id: string;
 *   publicKey: Uint8Array;
 * }
 * // The Ledger package writes `{ ..., owner: pkg.name }`.
 * ```
 */
export interface Owned {
  /** The name of the package that wrote this entry, e.g. `"@algorandfoundation/keystore-ledger"`. */
  owner: string;
}

/**
 * A predicate that matches the entries a package owns: those whose
 * {@link Owned.owner} equals `owner`. Exact match only.
 *
 * Every package hydrates and writes only the entries it owns, so a key list
 * has one writer per key.
 *
 * @param owner - The package name, e.g. `pkg.name`.
 * @returns Whether an entry belongs to that package.
 *
 * @example
 * ```typescript
 * import pkg from "../package.json" with { type: "json" };
 *
 * const mine = store.state.keys.filter(ownedBy(pkg.name));
 * ```
 */
export function ownedBy(owner: string): (entry: Owned) => boolean {
  return (entry) => entry?.owner === owner;
}

/**
 * Attaches operations to an entry as non-enumerable, read-only properties.
 *
 * Entries live in a reactive store and travel through bridges, so they stay
 * data. The functions are re-attached in memory after every store change and
 * are invisible to `JSON.stringify`, `structuredClone` and object spread.
 * Operations the entry already has are left alone, so the call is idempotent
 * and safe to run on every emit.
 *
 * @template T - The entry.
 * @template Ops - The operations to attach.
 * @param entry - The entry to hydrate. Mutated in place and returned.
 * @param ops - The operations, keyed by name.
 * @returns The same entry, typed with the operations as read-only members.
 *
 * The entry type declares its operations as optional properties, so a read
 * needs no cast and reflects that an entry may not be hydrated yet.
 *
 * @example
 * ```typescript
 * interface KeyEntry extends Owned {
 *   id: string;
 *   sign?: (bytes: Uint8Array) => Uint8Array; // filled by hydration
 * }
 *
 * store.subscribe((state) => {
 *   if (state.status !== "ready") return;
 *   for (const key of state.keys.filter(ownedBy(pkg.name))) {
 *     hydrate(key, { sign: (bytes: Uint8Array) => ledger.sign(key.id, bytes) });
 *   }
 * });
 * ```
 */
export function hydrate<T extends object, Ops extends object>(
  entry: T,
  ops: Ops,
): T & Readonly<Ops> {
  for (const name of Object.keys(ops) as (keyof Ops & string)[]) {
    if (name in entry) continue;
    Object.defineProperty(entry, name, {
      value: ops[name],
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }
  return entry as T & Readonly<Ops>;
}

/**
 * Whether a value is a group to merge into. Anything else (primitives,
 * arrays, class instances, objects with methods) is a mounted surface.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return false;
  }
  return !Object.values(value).some((member) => typeof member === "function");
}

/** Deep-merges `surface` into a shallow copy of `existing`, never mutating either. */
function merge(
  existing: Record<string, unknown>,
  surface: Record<string, unknown>,
  path: string[],
): Record<string, unknown> {
  const result = { ...existing };
  for (const key of Object.keys(surface)) {
    const value = surface[key];
    if (value === undefined) continue;
    const current = result[key];
    const at = [...path, key].join(".");

    if (current === undefined) {
      result[key] = value;
      continue;
    }
    if (!isPlainObject(current)) {
      throw new MountError(
        isPlainObject(value)
          ? `${at} is a mounted surface, not a namespace`
          : `${at} is already mounted on this provider`,
      );
    }
    if (!isPlainObject(value)) {
      throw new MountError(`${at} is already mounted on this provider`);
    }
    result[key] = merge(current, value, [...path, key]);
  }
  return result;
}

/**
 * Builds the object an extension returns to add its surface to a namespace:
 * `{ [namespace]: group }`, where `group` is a copy of `provider[namespace]`
 * with `surface` deep-merged in.
 *
 * Plain objects on both sides are groups and merge; anything else (a
 * keystore, a class instance, an object with methods) is a leaf and is
 * placed as is. Existing objects are never mutated, so every surface mounted
 * before this one survives, and every consumer reading `provider.key` finds
 * them all.
 *
 * @template N - The registered namespace name.
 * @param provider - The provider the extension is being applied to.
 * @param namespace - The namespace to extend (e.g. `"key"`).
 * @param surface - The branch this extension contributes.
 * @returns The object to return (or spread into) from the extension.
 * @throws {MountError} If `surface` places a value where a leaf is already
 * mounted (`key.store` twice), or descends into a leaf as if it were a group.
 *
 * @example
 * ```typescript
 * export const WithKeyStore: Extension<KeyStoreExtension> = (provider, options) => {
 *   const store = options.keystore?.store;
 *   if (!store) throw new Error("WithKeyStore requires options.keystore.store");
 *   return {
 *     ...extendNamespace(provider, "key", { store: createKeyStore({ store, owner: pkg.name }) }),
 *     get keys() { return store.state.keys; },
 *   };
 * };
 *
 * // A Ledger joining a provider that already has `key.store`:
 * extendNamespace(provider, "key", { hardware: { ledger } });
 * // => { key: { store, hardware: { ledger } } }
 * ```
 */
export function extendNamespace<N extends Namespace>(
  provider: NamespaceHost,
  namespace: N,
  surface: Contribution<Namespaces[N]>,
): { [K in N]: Namespaces[N] } {
  const existing: unknown = provider?.[namespace];
  const root: Record<string, unknown> =
    existing !== null && typeof existing === "object" ? (existing as Record<string, unknown>) : {};
  const group = merge(root, (surface ?? {}) as Record<string, unknown>, [namespace]);
  return { [namespace]: group } as unknown as { [K in N]: Namespaces[N] };
}
