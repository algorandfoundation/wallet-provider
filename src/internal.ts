/**
 * Bookkeeping shared by `extendNamespace` and the `Provider` constructor.
 *
 * `extendNamespace` records which `provider[namespace]` value each group it
 * builds was copied from. The constructor consults that record when an
 * extension returns a top-level key the provider already has: a group built
 * from the current value is the namespace being extended and replaces it; any
 * other value is a collision.
 *
 * Not exported from the package.
 */

/** Group copy → the `provider[namespace]` value it was built from. */
const derivations = new WeakMap<object, object>();

/** Records that `group` is a copy of `base` with a surface merged in. */
export function recordDerivation(group: object, base: object): void {
  derivations.set(group, base);
}

/**
 * Whether `next` was built by `extendNamespace` from `current`, directly or
 * through intermediate copies.
 */
export function derivesFrom(next: unknown, current: unknown): boolean {
  let group: unknown = next;
  while (typeof group === "object" && group !== null) {
    const base = derivations.get(group);
    if (base === undefined) return false;
    if (base === current) return true;
    group = base;
  }
  return false;
}
