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
 * list. Every entry is an {@link Entity}: the domain says what it is
 * (`type`), the writing package says who owns it (`owner`) and keeps its own
 * data in `metadata`. A package hydrates only what it owns: {@link ownedBy}
 * picks its entries, {@link hydrate} attaches the operations after every
 * store change. Both {@link ownedBy} and {@link ofType} narrow, so a filtered
 * list is typed without a cast.
 */

import { recordDerivation } from "./internal.ts";
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
 * Thrown when a surface cannot be mounted. From `extendNamespace`: the
 * contribution places a value where one is already mounted, or descends into
 * a mounted surface as if it were a group. From the `Provider` constructor:
 * an extension returns a property the provider already has (a core field or
 * one an earlier extension mounted) instead of extending it.
 */
export class MountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MountError";
  }
}

/**
 * The shape every entry of a domain store shares: what it is, who wrote it,
 * and the writer's own data. Operations are attached later by {@link hydrate}.
 *
 * The two tags are different axes and both are needed. `type` is the
 * domain's vocabulary (`"ed25519"`, `"algorand"`) and decides the
 * domain-level fields an entry carries (a public key, an address); the
 * package that owns the domain declares them. `owner` is the writing
 * package's name and decides what `metadata` holds (a derivation index, a
 * BIP-32 path); the writer declares it on the {@link Owners} registry. Two
 * packages can write the same `type`, and one package can write dozens of
 * them, so neither tag can stand in for the other.
 *
 * The `owner` value is the package name, unique by construction and readable
 * in persisted data. Every writer tags, the local keystore included; there is
 * no reserved default. Core cannot discover the name at runtime, so the
 * package declares it once.
 *
 * @template Type - The domain kind, a string literal union in a domain's entry type.
 * @template Metadata - The writer's data. Defaults to an open record; narrowed by {@link ownedBy}.
 * @template Owner - The writing package's name. Stays `string` in a domain's entry type.
 *
 * @example
 * ```typescript
 * // The keystore package owns the `type` axis and the domain-level fields:
 * interface KeyTypes {
 *   ed25519: { publicKey: Uint8Array };
 *   secp256k1: { publicKey: Uint8Array; compressed: boolean };
 * }
 * type KeyEntry = {
 *   [T in keyof KeyTypes]: Entity<T> & KeyTypes[T] & { id: string; sign?: Signer };
 * }[keyof KeyTypes];
 *
 * // The Ledger package writes `{ type: "ed25519", owner: OWNER, metadata: { bip32Path }, ... }`.
 * ```
 */
export interface Entity<
  Type extends string = string,
  Metadata extends object = Record<string, unknown>,
  Owner extends string = string,
> {
  /** The domain kind, e.g. `"ed25519"`. Set by the domain, not by the writer. */
  type: Type;
  /** The name of the package that wrote this entry, e.g. `"@algorandfoundation/keystore-ledger"`. */
  owner: Owner;
  /** The writer's own data. Only the owner reads it; core never looks inside. */
  metadata: Metadata;
}

/**
 * The one field {@link ownedBy} needs: an entry tagged with the package that
 * wrote it. Every {@link Entity} is `Owned`; the narrower trait is kept for
 * predicates and for entries that predate `type` and `metadata`.
 */
export interface Owned {
  /** The name of the package that wrote this entry, e.g. `"@algorandfoundation/keystore-ledger"`. */
  owner: string;
}

/**
 * Registry of writers: a declaration-merged interface every package that
 * writes entries augments with its own name and the `metadata` shape it
 * writes under that name.
 *
 * Registering makes {@link ownedBy} narrow `metadata` as well as `owner`, so
 * `store.state.keys.filter(ownedBy(OWNER))` types `metadata.bip32Path`
 * without a cast. Unregistered owners still match; their `metadata` stays
 * the open record the entry type declares.
 *
 * The key has to be a literal for the narrowing to happen. A `package.json`
 * import types `name` as `string`, so declare the literal once and assert
 * it against `pkg.name` in a test.
 *
 * @example
 * ```typescript
 * // In the Ledger package:
 * export const OWNER = "@algorandfoundation/keystore-ledger" as const;
 *
 * declare module "@algorandfoundation/wallet-provider" {
 *   interface Owners {
 *     [OWNER]: { deviceId: string; bip32Path: string };
 *   }
 * }
 * ```
 */
export interface Owners {}

/**
 * What {@link ownedBy} adds to an entry it matched: the owner literal and, for
 * a registered owner, that owner's `metadata` shape.
 *
 * @template O - The owner name passed to {@link ownedBy}.
 */
export type OwnedBy<O extends string> = O extends keyof Owners
  ? { owner: O; metadata: Owners[O] }
  : { owner: O };

/**
 * A predicate that matches the entries a package owns: those whose
 * {@link Owned.owner} equals `owner`. Exact match only.
 *
 * Every package hydrates and writes only the entries it owns, so a key list
 * has one writer per key.
 *
 * The predicate narrows. Given a literal owner it types the match as the
 * entry with that `owner`, and, when the owner is registered on
 * {@link Owners}, with that owner's `metadata`. A `string` owner matches the
 * same entries and narrows nothing.
 *
 * @template O - The owner name. A literal when declared `as const`.
 * @param owner - The package name, e.g. `OWNER`.
 * @returns Whether an entry belongs to that package.
 *
 * @example
 * ```typescript
 * const mine = store.state.keys.filter(ownedBy(OWNER));
 * mine[0]?.metadata.bip32Path; // typed from `Owners[typeof OWNER]`
 * ```
 */
export function ownedBy<O extends string>(
  owner: O,
): <E extends Owned>(entry: E) => entry is E & OwnedBy<O> {
  return <E extends Owned>(entry: E): entry is E & OwnedBy<O> => entry?.owner === owner;
}

/**
 * A predicate that matches the entries of one domain kind: those whose
 * {@link Entity.type} equals `type`. Exact match only.
 *
 * The predicate narrows a union entry type to the members with that `type`,
 * so the domain-level fields of that kind are typed after a `filter` or
 * `find`. Compose with {@link ownedBy} to narrow both axes.
 *
 * @template T - The domain kind. A literal when written inline or declared `as const`.
 * @param type - The kind, e.g. `"ed25519"`.
 * @returns Whether an entry is of that kind.
 *
 * @example
 * ```typescript
 * const eds = store.state.keys.filter(ofType("ed25519"));
 * eds[0]?.publicKey; // typed from the `ed25519` member of `KeyEntry`
 * ```
 */
export function ofType<T extends string>(
  type: T,
): <E extends Pick<Entity, "type">>(entry: E) => entry is Extract<E, { type: T }> {
  return <E extends Pick<Entity, "type">>(entry: E): entry is Extract<E, { type: T }> =>
    entry?.type === type;
}

/**
 * Attaches operations to an entry as non-enumerable, read-only properties.
 *
 * Entries live in a reactive store and travel through bridges, so they stay
 * data. The functions are re-attached in memory after every store change and
 * are invisible to `JSON.stringify`, `structuredClone` and object spread.
 * Operations the entry already has as own properties are left alone, so the
 * call is idempotent and safe to run on every emit. Inherited names (such as
 * `toString`) do not count: an operation with that name is attached.
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
 * interface KeyEntry extends Entity<"ed25519"> {
 *   id: string;
 *   sign?: (bytes: Uint8Array) => Uint8Array; // filled by hydration
 * }
 *
 * store.subscribe((state) => {
 *   if (state.status !== "ready") return;
 *   for (const key of state.keys.filter(ownedBy(OWNER))) {
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
    if (Object.hasOwn(entry, name)) continue;
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
 * Whether a value is a plain object: built from `{}` or `Object.create(null)`.
 * A class instance, a `Map` or an array is not, and is a leaf wherever it
 * sits, the root of a namespace included: a copy cannot preserve what it
 * carries (`this` bound at construction, private fields, internal slots).
 */
function hasPlainPrototype(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Whether a value is a group: a plain object whose members are all data (no
 * functions, no getters/setters). Anything else is a leaf.
 *
 * This decides the members of a namespace. The root only needs
 * {@link hasPlainPrototype}; its members are decided one by one, so a root
 * carrying a getter (`get store()`) can still be extended.
 *
 * Members are inspected through their descriptors, so no getter runs.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!hasPlainPrototype(value)) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (member) => "value" in member && typeof member.value !== "function",
  );
}

/**
 * The value a data property holds, or `undefined` for a missing property.
 * An accessor is reported as itself (never invoked), so it always counts as
 * a mounted leaf.
 */
function peek(descriptor: PropertyDescriptor | undefined): unknown {
  if (descriptor === undefined) return undefined;
  return "value" in descriptor ? descriptor.value : descriptor;
}

/**
 * Deep-merges `surface` into a copy of `existing`; neither is mutated.
 * Members are copied by property descriptor, so getters stay live.
 *
 * The result is frozen at every level. A plain object the contribution
 * places is copied and frozen too, never aliased. Leaves are placed as is
 * and never frozen.
 */
function merge(
  existing: object,
  surface: Record<string, unknown>,
  path: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(existing)) {
    const descriptor = Object.getOwnPropertyDescriptor(existing, key)!;
    Object.defineProperty(result, key, { ...descriptor, configurable: true });
  }
  for (const key of Object.keys(surface)) {
    const descriptor = Object.getOwnPropertyDescriptor(surface, key)!;
    const isAccessor = !("value" in descriptor);
    if (!isAccessor && descriptor.value === undefined) continue;
    const currentDescriptor = Object.getOwnPropertyDescriptor(result, key);
    const at = [...path, key].join(".");

    if (peek(currentDescriptor) === undefined) {
      Object.defineProperty(result, key, {
        ...descriptor,
        ...(isPlainObject(descriptor.value) && {
          value: merge({}, descriptor.value, [...path, key]),
        }),
        enumerable: true,
        configurable: true,
      });
      continue;
    }
    const current =
      currentDescriptor && "value" in currentDescriptor ? currentDescriptor.value : undefined;
    const value = isAccessor ? undefined : descriptor.value;
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
    Object.defineProperty(result, key, {
      value: merge(current, value, [...path, key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return Object.freeze(result);
}

/**
 * Builds the object an extension returns to add its surface to a namespace:
 * `{ [namespace]: group }`, where `group` is a copy of `provider[namespace]`
 * with `surface` deep-merged in. Nothing is mutated, so every surface
 * mounted before this one survives.
 *
 * Two kinds of value take part:
 *
 * - A **group** is a plain object (`{}` or `Object.create(null)`) whose
 *   members are all data. Groups merge.
 * - A **leaf** is anything else: a store, a class instance, an array, an
 *   object with a method or getter. A leaf is placed as is and can neither
 *   be merged into nor replaced.
 *
 * Rules:
 *
 * - **The root must be a group.** `provider[namespace]` is merged into when
 *   it is a plain object and starts empty when missing. A class instance (or
 *   `Map`, array) there throws a `MountError`. Keep state in a store leaf
 *   (`key.store`), not on the namespace object.
 * - **A group is data only.** One function or getter makes the whole object
 *   a leaf: after `{ hardware: { ledger, list() {} } }`, a later
 *   `{ hardware: { trezor } }` throws. Put helpers on a leaf beneath the
 *   group (`key.hardware.ledger`).
 * - **Groups are frozen.** `provider.key.hardware = …` throws a `TypeError`,
 *   at the root and in nested groups. To add to a namespace, call this
 *   function again. Leaves are never frozen. The lock is runtime-only:
 *   `Namespaces[N]` is not typed `Readonly`.
 * - **Getters stay live.** Members are copied by property descriptor, so a
 *   getter is mounted as a getter, not read once. A getter is a leaf.
 * - **Read the namespace lazily.** Each call returns a new copy, so a
 *   `provider.key` captured while an extension runs misses what later
 *   extensions add. Read `provider.key` at call time; leaves
 *   (`provider.key.store`) are safe to keep.
 *
 * @template N - The registered namespace name.
 * @param provider - The provider the extension is being applied to.
 * @param namespace - The namespace to extend (e.g. `"key"`).
 * @param surface - The branch this extension contributes.
 * @returns The object to return (or spread into) from the extension.
 * @throws {MountError} If `surface` places a value on a mounted leaf
 * (`key.store` twice), descends into a leaf as if it were a group, or
 * `provider[namespace]` is a leaf rather than a group.
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
  // A plain object is the root to merge into; a missing namespace (or a
  // primitive there) starts an empty group; any other object is a surface.
  if (existing !== null && typeof existing === "object" && !hasPlainPrototype(existing)) {
    throw new MountError(`${namespace} is a mounted surface, not a namespace`);
  }
  const root: object | undefined = hasPlainPrototype(existing) ? existing : undefined;
  const group = merge(root ?? {}, (surface ?? {}) as Record<string, unknown>, [namespace]);
  // Let the Provider constructor tell this group (the namespace, extended)
  // from an unrelated value returned under the same key (a collision).
  if (root !== undefined) recordDerivation(group, root);
  return { [namespace]: group } as unknown as { [K in N]: Namespaces[N] };
}
