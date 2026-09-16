import type { NamespaceHost } from "./namespace.ts";

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
 * Both parameters are typed by the registries: `provider` is a
 * {@link NamespaceHost} (the core plus every namespace registered on
 * `Namespaces`, each optional), and `options` is the single
 * {@link ExtensionOptions} registry. Register your `options.<domain>` slice
 * and your `provider.<namespace>` via declaration merging and read them
 * directly; an unregistered name is a compile error.
 *
 * @template T - The type of the object that the extension returns, which will be merged into the Provider instance.
 *
 * @example
 * ```typescript
 * declare module "@algorandfoundation/wallet-provider" {
 *   interface ExtensionOptions {
 *     greeter?: { loud?: boolean };
 *   }
 * }
 * const myExtension: Extension<{ sayHello: () => void }> = (provider, options) => {
 *   const signer = provider.key?.store; // typed from `Namespaces["key"]`, undefined until mounted
 *   return {
 *     sayHello: () => console.log(`Hello from ${provider.name}${options.greeter?.loud ? "!!!" : "!"}`)
 *   };
 * };
 * ```
 */
export type Extension<T = any> = (provider: NamespaceHost, options: ExtensionOptions) => T;

/**
 * A readonly list of {@link Extension | extensions}: the constraint (and
 * default) for the extensions seat across {@link Provider},
 * {@link BaseProvider}, and {@link Provider.withExtensions}.
 *
 * Naming the list keeps annotations readable: a bare `Provider` displays as
 * `Provider<Extensions>` instead of echoing a resolved tuple of function
 * signatures.
 */
export type Extensions = readonly Extension[];

// Ideal Extension Configuration Object:
// {
//     accounts: true, // Allow for Transaction Singers based on any available extensions that can provide accounts.
//     keystore: true, // Allow for direct access to the underlying keystore.
// }

/**
 * The single provider options type: a declaration-merged registry every
 * extension module contributes its `options.<domain>` namespace to.
 *
 * Extensions claim their configuration under `options.<domain>` namespaces.
 * Instead of inferring the merge per extensions tuple (which erases the type
 * name in renders), each extension REGISTERS its namespace on this interface
 * via module augmentation, so `ExtensionOptions` is one named type with
 * everything on it, and hovers print the compact name
 * (`options?: ExtensionOptions`) while autocomplete and go-to-definition
 * surface every registered namespace. Unregistered namespaces are rejected at
 * the call site.
 *
 * @example
 * ```typescript
 * // In the extension module: register the namespace it claims:
 * declare module "@algorandfoundation/wallet-provider" {
 *   interface ExtensionOptions {
 *     connections?: { signalUrl?: string };
 *   }
 * }
 *
 * // At the composition root: every registered namespace is typed:
 * const provider = new DappProvider(config, {
 *   connections: { signalUrl: "wss://signal" },
 * });
 * ```
 */
export interface ExtensionOptions {}

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
export type InferExtensions<E extends Extensions> = UnionToIntersection<
  ExtractExtensionReturn<E[number]>
>;

/**
 * Flattens an intersection into a single object type for display.
 *
 * Applied to a composed provider it makes hovers/quick-info print ONE object
 * listing every member: the {@link Provider} core (`id`, `name`, …), each
 * namespace an extension contributes (`connection`, `account`, `identity`,
 * `key`, …), and any state an extension adds to the global surface (reactive
 * getters print as `readonly` properties). The flatten is shallow: namespace
 * APIs keep their named types.
 *
 * @template T - The intersection (or object type) to flatten.
 */
export type Composed<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Type helper for a {@link Provider} instance that has been augmented with {@link Extension | extensions}.
 *
 * The type is the {@link Composed | flattened} merge of the {@link Provider}
 * class and every surface the extensions declare as their return type, so
 * hovers/quick-info print a single object (core provider fields, the
 * extension namespaces, and any extension-added global state) instead of an
 * intersection chain or the extensions tuple.
 *
 * The `options` property is the single {@link ExtensionOptions} registry,
 * the interface every extension module augments with its `options.<domain>`
 * namespace, so it renders as one compact named type.
 *
 * @template E - The array of extensions applied to the provider.
 */
export type BaseProvider<E extends Extensions = any[]> = Composed<Provider & InferExtensions<E>>;

/**
 * Base class for managing configurations and extensions dynamically.
 *
 * The `Provider` class represents a wallet's identity and core configuration.
 * It can be extended with {@link Extension | extensions} to add specific capabilities.
 *
 * @template _E - The array of extensions applied to this provider. Phantom on the
 * instance side (defaulted to {@link Extensions}, so bare `Provider` is a legal
 * annotation and displays as `Provider<Extensions>`); the tuple only matters for
 * the `EXTENSIONS` static tied by {@link withExtensions}.
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
export class Provider<_E extends Extensions = Extensions> {
  /** Unique identifier for the provider instance. */
  id: ProviderId;
  /** Human-readable name of the provider. */
  name: string;
  /** Optional icon for the provider. */
  icon?: string;

  /**
   * Sharable Provider URI.
   * Can be used for deep linking (e.g., `wallet://perawallet.app/onboard?extensions=[...]`).
   */
  uri?: URL | string;

  /**
   * Merged configuration options for the provider and its extensions.
   */
  options: ExtensionOptions;

  /**
   * Default options for the Provider class.
   */
  static DEFAULTS = {};

  /**
   * Extensions to be applied to all instances of this Provider class.
   * Use {@link withExtensions} to create a subclass with specific extensions.
   */
  static EXTENSIONS: Extensions = [];

  /**
   * Constructs a new Provider instance.
   *
   * It merges the provided `options` with {@link DEFAULTS} and applies all {@link EXTENSIONS}
   * to the instance, merging their return values into `this`.
   *
   * @param config - Core metadata for the provider.
   * @param options - Custom configuration options for extensions.
   *
   * @remarks
   * The `options` parameter is deliberately left untyped here (`ExtensionOptions | any`
   * collapses to `any`). The base class is the seat of the *concrete-class pattern*,
   * `class MyWallet extends Provider { … }`, where a subclass owns its own option
   * shape and applies extensions imperatively, so the base constructor must accept any
   * bag without forcing every subclass to augment the {@link ExtensionOptions}
   * registry first.
   *
   * {@link withExtensions} is the **single typed overload**: the class it returns
   * drops this loose construct signature and types `options` as the
   * {@link ExtensionOptions} registry, so at a composition root an unregistered
   * `options.<domain>` namespace is a compile error rather than an `any` fallback.
   * Prefer `Provider.withExtensions([...])` whenever the options should be checked.
   *
   * @throws {TypeError} If an extension returns a Promise. Extensions are
   * applied synchronously; async extensions are not supported (yet), so the
   * constructor fails fast instead of silently discarding the resolved surface.
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

    // Apply extensions to the current instance
    (this.constructor as typeof Provider).EXTENSIONS.forEach((ext: Extension) => {
      const result = ext(this, this.options);
      // Fail fast on async extensions: merging a pending Promise would silently
      // discard the resolved surface.
      if (result instanceof Promise || typeof result?.then === "function") {
        throw new TypeError(
          `Extension for provider "${this.id}" returned a Promise. Extensions are applied synchronously; async extensions are not supported.`,
        );
      }
      Object.defineProperties(this, Object.getOwnPropertyDescriptors(result));
    });
  }

  /**
   * Creates a new Provider class that includes the specified extensions.
   *
   * This method uses composition to augment the Provider class with additional functionality
   * defined by the extensions.
   *
   * Instances of the returned class are typed as {@link BaseProvider}`<E>`, the
   * {@link Composed | flattened} merge of the Provider core and every extension
   * surface, so hovers print one object with every namespace and
   * extension-added property visible, rather than an intersection chain or the
   * extensions tuple.
   *
   * The options get the same treatment: the constructor's `options` parameter
   * (and the instance's `options` property) is the single
   * {@link ExtensionOptions} registry, the interface every extension module
   * augments with its `options.<domain>` namespace, so each registered
   * namespace is fully typed at the call site while the property renders as
   * one compact named type.
   *
   * The type parameter is `const`, so a heterogeneous array literal keeps
   * its tuple type (no `as const` at the call site) and every extension's
   * surface reaches the instance type instead of collapsing to `Extension[]`.
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
  static withExtensions<const E extends Extensions>(
    extensions: E,
  ): {
    // Inline the {@link BaseProvider} shape (spelled out) so quick-info expands
    // instances to the flattened object instead of echoing an alias over the
    // extensions tuple. The options parameter/property is the {@link ExtensionOptions}
    // registry; declaration merging keeps its interface identity, so it
    // renders as the single compact name.
    new (
      config: ProviderOptions,
      options?: ExtensionOptions,
    ): Composed<Provider & InferExtensions<E>>;
    EXTENSIONS: E;
    // Statics only (`Omit` keeps every static member but drops the base
    // construct signature); the typed signature above is the single overload,
    // so mistyped options error instead of falling back to `options?: any`.
  } & Omit<typeof Provider, never> {
    return class extends (this as any) {
      static EXTENSIONS = extensions;
    } as any;
  }
}
