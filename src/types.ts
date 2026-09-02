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
 * Composition-time configuration for {@link Provider.withExtensions}.
 */
export type WithExtensionsOptions = {
  /**
   * Property keys that a later extension is allowed to redefine after an earlier
   * extension has contributed them.
   *
   * Redefining a property is otherwise rejected with an {@link ExtensionCollisionError},
   * so intentional shadowing has to be declared here, at the composition site, where it
   * can be audited. Base provider properties (`id`, `name`, `icon`, `uri`, `options`)
   * can never be redefined, even when listed.
   */
  allowOverrides?: readonly PropertyKey[];
};

/**
 * Thrown during {@link Provider} construction when an extension returns a property
 * that is already defined on the provider — either a base provider property or a
 * capability contributed by an earlier extension.
 *
 * Without this check the later extension would silently win, turning an accidental
 * name collision (or a compromised extension dependency) into capability confusion.
 * Intentional shadowing of extension-contributed properties must be declared via
 * {@link WithExtensionsOptions.allowOverrides}.
 */
export class ExtensionCollisionError extends Error {
  /** The property key the extension attempted to redefine. */
  readonly property: PropertyKey;

  constructor(property: PropertyKey) {
    super(
      `Extension attempted to redefine "${String(property)}", which is already defined on the provider. ` +
        `Intentional overrides of extension-contributed properties must be declared via withExtensions' allowOverrides.`,
    );
    this.name = "ExtensionCollisionError";
    this.property = property;
  }
}

/**
 * Base provider properties that no extension may redefine, with or without an
 * {@link WithExtensionsOptions.allowOverrides} declaration.
 */
const RESERVED_PROVIDER_KEYS: ReadonlySet<PropertyKey> = new Set([
  "id",
  "name",
  "icon",
  "uri",
  "options",
]);

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
  /** Unique identifier for the provider instance. Locked (non-writable) after construction. */
  readonly id: ProviderId;
  /** Human-readable name of the provider. Locked (non-writable) after construction. */
  readonly name: string;
  /** Optional icon for the provider. */
  icon?: string;

  /**
   * Sharable Provider URI.
   * Can be used for deep linking (e.g., `wallet://perawallet.app/onboard?extensions=[...]`).
   * Locked (non-writable) after construction.
   */
  readonly uri?: URL | string;

  /**
   * Merged configuration options for the provider and its extensions.
   * The reference is locked before extensions run and the object is frozen
   * (shallow) once construction completes.
   */
  readonly options: ExtensionOptions;

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
   * Extension-contributed property keys that a later extension may redefine.
   * Set via {@link withExtensions}' `allowOverrides`; empty by default, so every
   * collision is rejected with an {@link ExtensionCollisionError}.
   */
  static OVERRIDES: readonly PropertyKey[] = [];

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
    // Metadata
    this.id = config.id;
    this.name = config.name;
    this.icon = config.icon;

    // Provider URI
    this.uri = config.uri;

    // Assign the options to this instance, including DEFAULTS
    this.options = {
      ...(this.constructor as typeof Provider).DEFAULTS,
      ...options,
    };

    // Lock base identity and the options reference before any extension code runs,
    // so an extension can neither redefine them (rejected below) nor mutate them
    // directly through the provider reference it receives.
    for (const key of ["id", "name", "uri", "options"]) {
      Object.defineProperty(this, key, { writable: false, configurable: false });
    }

    const allowedOverrides = new Set((this.constructor as typeof Provider).OVERRIDES);

    // Apply extensions to the current instance
    (this.constructor as typeof Provider).EXTENSIONS.forEach((ext: Extension) => {
      const result = ext(this, this.options);
      const descriptors = Object.getOwnPropertyDescriptors(result);
      for (const key of Reflect.ownKeys(descriptors)) {
        const isCollision = Object.prototype.hasOwnProperty.call(this, key);
        if (isCollision && (RESERVED_PROVIDER_KEYS.has(key) || !allowedOverrides.has(key))) {
          throw new ExtensionCollisionError(key);
        }
      }
      Object.defineProperties(this, descriptors);
    });

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
   * @param options - Composition-time configuration, e.g. audited `allowOverrides` declarations.
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
    options?: WithExtensionsOptions,
  ): {
    new (config: ProviderOptions, options?: any): Provider<E> & InferExtensions<E>;
    EXTENSIONS: E;
  } & typeof Provider {
    return class extends (this as any) {
      static EXTENSIONS = extensions;
      static OVERRIDES = options?.allowOverrides ?? [];
    } as any;
  }
}
