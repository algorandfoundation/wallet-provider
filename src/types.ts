/**
 * Represents a unique identifier for a provider.
 */
export type ProviderId = string;

/**
 * An Extension is a function that augments a {@link Provider} instance with additional functionality.
 *
 * Extensions are the primary way to add capabilities to a provider, such as account management,
 * transaction signing, or custom API integrations.
 *
 * @template T - The type of the object that the extension returns, which will be merged into the Provider instance.
 *
 * @example
 * ```typescript
 * const myExtension: Extension<{ sayHello: () => void }> = (provider, options) => {
 *   return {
 *     sayHello: () => console.log(`Hello from ${provider.name}!`)
 *   };
 * };
 * ```
 */
export type Extension<T = any> = (provider: any, options: any) => T;

// Ideal Extension Configuration Object:
// {
//     accounts: true, // Allow for Transaction Singers based on any available extensions that can provide accounts.
//     keystore: true, // Allow for direct access to the underlying keystore.
// }

/**
 * Configuration options for an extension.
 *
 * This interface allows you to specify various features or capabilities
 * that the extension can support or interact with.
 *
 * @example
 * ```typescript
 * const options: ExtensionOptions = {
 *   accounts: true,
 *   crypto: {
 *     bip39: true
 *   }
 * };
 * ```
 */
export type ExtensionOptions = {};

// Ideal Provider Configuration Object:
// {
//     id: "a24dd2f6-e9b7-48ff-8cc0-74b7a446dc1b",
//     name: "The Wallet Company,
//     uri: "provider://wallet.company/onboard?extensions=[...]",
//     icon: "data-url"
// }

/**
 * Configuration options for a {@link Provider}.
 *
 * @example
 * ```typescript
 * const config: ProviderOptions = {
 *   id: "my-provider",
 *   name: "My Wallet",
 *   icon: "https://example.com/icon.png",
 *   uri: "https://mywallet.com"
 * };
 * ```
 */
export interface ProviderOptions {
  /**
   * Unique identifier for the provider.
   */
  id: ProviderId;
  /**
   * Human-readable name of the provider.
   */
  name: string;
  /**
   * Optional URL or data URI for the provider's icon.
   */
  icon?: string;
  /**
   * Optional base URI for the provider, used for deep linking or API discovery.
   */
  uri?: URL | string;
  /**
   * Optional port number if the provider communicates over a specific port.
   */
  port?: number;
  /**
   * Whether to use SSL for communication.
   */
  ssl?: boolean;
}

/**
 * Internal utility to convert a union of types to an intersection.
 *
 * @protected
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

/**
 * Internal utility to extract the return type of an {@link Extension}.
 *
 * @protected
 */
type ExtractExtensionReturn<E> =
  E extends Extension<infer R> ? (R extends Promise<infer PR> ? PR : R) : unknown;

/**
 * Infers the combined return type of an array of {@link Extension | extensions}.
 *
 * @template E - The array of extensions.
 * @protected
 */
export type InferExtensions<E extends readonly Extension[]> = UnionToIntersection<
  ExtractExtensionReturn<E[number]>
>;

/**
 * Type helper for a {@link Provider} instance that has been augmented with {@link Extension | extensions}.
 *
 * @template E - The array of extensions applied to the provider.
 */
export type BaseProvider<E extends readonly Extension[] = any[]> = Provider<E> & InferExtensions<E>;

/**
 * Thrown during {@link Provider} construction when an extension's contribution
 * would conflict with what is already on the provider: a reserved base property,
 * a capability contributed by an earlier extension that cannot be merged, or a
 * differing leaf value inside a merged domain namespace.
 *
 * Without this check the later extension would silently win, turning an accidental
 * name collision (or a compromised extension dependency) into capability confusion.
 * Same-key contributions of plain-object namespaces are merged instead — see the
 * extension loop in {@link Provider}'s constructor.
 */
export class ExtensionCollisionError extends Error {
  /** The top-level provider property key the conflict occurred under. */
  readonly property: PropertyKey;

  constructor(property: PropertyKey, detail?: string) {
    super(
      `Extension contribution conflicts at "${detail ?? String(property)}", which is already defined. ` +
        `Same-key plain-object namespaces are merged; anything else must use a distinct key.`,
    );
    this.name = "ExtensionCollisionError";
    this.property = property;
  }
}

/**
 * Base provider properties defined non-writable and non-configurable at
 * construction, before any extension code runs.
 */
export const LOCKED_PROVIDER_KEYS: readonly ["id", "name", "icon", "uri", "options"] = [
  "id",
  "name",
  "icon",
  "uri",
  "options",
];

/**
 * Property keys no extension may contribute. The locked base properties, plus
 * `toJSON`: an instance-level `toJSON` would let `JSON.stringify` misreport the
 * locked identity even though the identity properties themselves cannot change.
 */
export const RESERVED_PROVIDER_KEYS: ReadonlySet<PropertyKey> = new Set([
  ...LOCKED_PROVIDER_KEYS,
  "toJSON",
]);

const isPlainObject = (value: unknown): value is Record<PropertyKey, unknown> => {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Merges a later extension's re-returned domain namespace into the existing one:
 * new keys are copied over, reference-equal values are accepted as no-ops, and
 * nested plain objects merge recursively. Anything else — a differing leaf, an
 * accessor, a non-extensible target — is a conflict.
 *
 * `rootKey` is the top-level provider property the merge started from; `path`
 * tracks the position for error messages.
 */
const mergeNamespace = (
  target: Record<PropertyKey, unknown>,
  source: Record<PropertyKey, unknown>,
  rootKey: PropertyKey,
  path: string,
): void => {
  for (const key of Reflect.ownKeys(source)) {
    const keyPath = `${path}.${String(key)}`;
    const incoming = Object.getOwnPropertyDescriptor(source, key)!;
    if (incoming.get || incoming.set) throw new ExtensionCollisionError(rootKey, keyPath);

    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      if (!Object.isExtensible(target)) throw new ExtensionCollisionError(rootKey, keyPath);
      Object.defineProperty(target, key, incoming);
      continue;
    }

    const existing = Object.getOwnPropertyDescriptor(target, key)!;
    if (existing.get || existing.set) throw new ExtensionCollisionError(rootKey, keyPath);
    if (Object.is(existing.value, incoming.value)) continue;
    if (isPlainObject(existing.value) && isPlainObject(incoming.value)) {
      mergeNamespace(existing.value, incoming.value, rootKey, keyPath);
      continue;
    }
    throw new ExtensionCollisionError(rootKey, keyPath);
  }
};

/**
 * Base class for managing configurations and extensions dynamically.
 *
 * The `Provider` class represents a wallet's identity and core configuration.
 * It can be extended with {@link Extension | extensions} to add specific capabilities.
 *
 * @template _E - The array of extensions applied to this provider.
 *
 * @example
 * ```typescript
 * // 1. Define an extension
 * const withLogger: Extension<{ log: (msg: string) => void }> = (provider) => ({
 *   log: (msg) => console.log(`[${provider.name}] ${msg}`)
 * });
 *
 * // 2. Create a specialized Provider class
 * const MyProvider = Provider.withExtensions([withLogger]);
 *
 * // 3. Instantiate the provider
 * const wallet = new MyProvider({ id: "p1", name: "My Wallet" });
 *
 * // 4. Use the extension functionality
 * wallet.log("Initialized!");
 * ```
 */
export class Provider<_E extends readonly Extension[]> {
  /** Unique identifier for the provider instance. Locked (non-writable) at construction. */
  declare readonly id: ProviderId;
  /** Human-readable name of the provider. Locked (non-writable) at construction. */
  declare readonly name: string;
  /** Optional icon for the provider. Locked (non-writable) at construction. */
  declare readonly icon?: string;

  /**
   * Sharable Provider URI.
   * Can be used for deep linking (e.g., `wallet://perawallet.app/onboard?extensions=[...]`).
   * Locked (non-writable) at construction.
   */
  declare readonly uri?: URL | string;

  /**
   * Merged configuration options for the provider and its extensions.
   * The reference is locked before extensions run and the object is frozen
   * (shallow) once construction completes.
   */
  declare readonly options: ExtensionOptions;

  /**
   * Default options for the Provider class.
   */
  static DEFAULTS = {};

  /**
   * Extensions to be applied to all instances of this Provider class.
   * Use {@link withExtensions} to create a subclass with specific extensions.
   */
  static EXTENSIONS: readonly Extension[] = [];

  /**
   * Constructs a new Provider instance.
   *
   * It merges the provided `options` with {@link DEFAULTS} and applies all {@link EXTENSIONS}
   * to the instance, merging their return values into `this`.
   *
   * @param config - Core metadata for the provider.
   * @param options - Custom configuration options for extensions.
   */
  constructor(config: ProviderOptions, options?: ExtensionOptions | any) {
    const ctor = this.constructor as typeof Provider;

    // Without extensions no third-party code touches the instance during
    // construction, so the locking below buys nothing — skip it and keep
    // bare-Provider construction on the fast path. The composition-safety
    // guarantees documented on this class apply to extension-composed
    // providers.
    if (ctor.EXTENSIONS.length === 0) {
      this.id = config.id;
      this.name = config.name;
      this.icon = config.icon;
      this.uri = config.uri;
      this.options = { ...ctor.DEFAULTS, ...options };
      return;
    }

    // Base identity and the options reference are defined locked, in one
    // defineProperties call, before any extension code runs — an extension can
    // neither contribute these keys (rejected below) nor mutate them directly
    // through the provider reference it receives.
    Object.defineProperties(this, {
      id: { value: config.id, writable: false, configurable: false, enumerable: true },
      name: { value: config.name, writable: false, configurable: false, enumerable: true },
      icon: { value: config.icon, writable: false, configurable: false, enumerable: true },
      uri: { value: config.uri, writable: false, configurable: false, enumerable: true },
      options: {
        value: { ...ctor.DEFAULTS, ...options },
        writable: false,
        configurable: false,
        enumerable: true,
      },
    });

    // Apply extensions to the current instance
    for (const ext of ctor.EXTENSIONS) {
      const result = ext(this, this.options);
      const descriptors = Object.getOwnPropertyDescriptors(result) as Record<
        PropertyKey,
        PropertyDescriptor
      >;
      for (const key of Reflect.ownKeys(descriptors)) {
        if (RESERVED_PROVIDER_KEYS.has(key)) throw new ExtensionCollisionError(key);
        const incoming = descriptors[key]!;

        // `in` (not hasOwnProperty), so shadowing inherited members such as
        // `toString` is rejected too, not just own properties.
        if (key in this) {
          const existing = Object.getOwnPropertyDescriptor(this, key);
          const isMergeable = existing && !existing.get && !incoming.get && !incoming.set;
          if (isMergeable && Object.is(existing.value, incoming.value)) {
            // Identical re-returned value: nothing to define.
          } else if (
            isMergeable &&
            isPlainObject(existing.value) &&
            isPlainObject(incoming.value)
          ) {
            // The domain-namespace idiom: a later extension re-returns
            // `{ domain: { … } }` to augment an earlier contribution in place.
            mergeNamespace(existing.value, incoming.value, key, String(key));
          } else {
            throw new ExtensionCollisionError(key);
          }
          delete descriptors[key];
          continue;
        }

        // Sealed as it lands: a later extension holding the provider reference
        // cannot reassign or redefine an earlier capability. Accessors must not
        // carry `writable`; live getters stay live, just non-redefinable.
        incoming.configurable = false;
        if (!incoming.get && !incoming.set) incoming.writable = false;
      }
      Object.defineProperties(this, descriptors);
    }

    // Shallow freeze: extensions merged their defaults during composition; from here
    // on the option set is fixed. Nested objects stay as mutable as their owners made them.
    Object.freeze(this.options);
  }

  /**
   * Creates a new Provider class that includes the specified extensions.
   *
   * This method uses composition to augment the Provider class with additional functionality
   * defined by the extensions.
   *
   * @param extensions - An array of {@link Extension} functions.
   * @returns A new Provider subclass with the extensions applied.
   *
   * @example
   * ```typescript
   * const EnhancedProvider = Provider.withExtensions([authExtension, txnExtension]);
   * const provider = new EnhancedProvider({ id: "id", name: "name" });
   * ```
   */
  static withExtensions<E extends readonly Extension[]>(
    extensions: E,
  ): {
    new (config: ProviderOptions, options?: any): Provider<E> & InferExtensions<E>;
    EXTENSIONS: E;
  } & typeof Provider {
    return class extends (this as any) {
      static EXTENSIONS = extensions;
    } as any;
  }
}
