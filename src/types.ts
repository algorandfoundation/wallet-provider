export type ProviderId = string;

export type Extension<T = any> = (
	provider: any,
	options: any,
) => T | Promise<T>;

// Ideal Extension Configuration Object:
// {
//     accounts: true, // Allow for Transaction Singers based on any available extensions that can provide accounts.
//     keystore: true, // Allow for direct access to the underlying keystore.
// }

/**
 * Represents configuration options for an extension.
 *
 * This interface allows you to specify various features or capabilities
 * that the extension can support or interact with. Each option is optional
 * and can be enabled, disabled, or set to a null value.
 *
 * @interface
 */
export interface ExtensionOptions {
	// The most critical extension, this is the transport for secret management.
	// (not all keystores will have direct access to the key material, maintaining non-exportability)
	keystore?: boolean | null | unknown;
	// Accounts, the most common form of key material.
	// These MUST provide TransactionSigners that are baked into the current Provider Context
	accounts?: boolean | null | unknown;

	// Cryptography extensions
	crypto?: {
		bip39?: boolean | null;
		algo25?: boolean | null;
		xhd?: boolean | null;
	};
}

// Ideal Provider Configuration Object:
// {
//     id: "a24dd2f6-e9b7-48ff-8cc0-74b7a446dc1b",
//     name: "The Wallet Company,
//     uri: "provider://wallet.company/onboard?extensions=[...]",
//     icon: "data-url"
// }

export type ProviderOptions = {
	/**
	 * Represents the unique identifier of a provider.
	 * This variable is used to associate specific functionality or data with a particular provider instance.
	 */
	id: ProviderId;
	name: string;
	icon?: string;
	uri?: URL | string;
	port?: number;
	ssl?: boolean;
};

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;

type ExtractExtensionReturn<E> =
	E extends Extension<infer R>
		? R extends Promise<infer PR>
			? PR
			: R
		: unknown;

export type InferExtensions<E extends readonly Extension[]> =
	UnionToIntersection<ExtractExtensionReturn<E[number]>>;

/**
 * Represents a base class for managing configurations and extensions dynamically.
 * The class provides functionality to merge options, extend defaults, and add custom extensions.
 *
 * Object that can hold state in a more composed way, allowing for more than just wallet effects
 * Inspired by the work of OctoKit and TxnLab Use Wallet
 */
export class Provider<_E extends readonly Extension[]> {
	// Metadata for the Provider
	id: ProviderId;
	name: string;
	icon?: string;

	// Sharable Provider URI. These assume that we will provide a URI schema for Providers+Extensions (TBD).
	// ie; wallet://intermezzo.app/onboard?extensions=[...]
	// ie: wallet://perawallet.app/onboard?extensions=[...]
	// Since we have the transports/rpc interfaces available and can construct the wallet dynamically, this is a viable option for trusted entities.
	uri?: URL | string;

	// Shared Options
	options: ExtensionOptions;

	// TBD: Defaults for the Provider
	static DEFAULTS = {};

	// Used to inject dependencies and|or check cross-dependencies between extensions
	// These can be independent packages consumed by the public or provided by third parties such as Pera
	static EXTENSIONS: readonly Extension[] = []; // This could include a baseline default like KeyStore + BIP39, it can be overridden by the user

	/**
	 * Constructs a new instance of the class with the provided options.
	 * It merges the default options with the supplied options and applies
	 * any extensions defined in the class to the current instance.
	 *
	 * @param config {ProviderOptions} - The unique identifier for the provider.
	 * @param {object} [options] - Optional configuration options to customize the instance and extensions.
	 *                              These options are merged with the default settings.
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
		(this.constructor as typeof Provider).EXTENSIONS.forEach(
			(ext: Extension) => {
				console.log(ext.name);
				const result = ext(this, this.options);
				console.log(result);
				Object.assign(this, result);
			},
		);
	}

	/**
	 * Creates and returns a new class that extends the current class, augmenting it with additional extensions.
	 *
	 * @param {Extension[]} extensions - An array of extensions to be added to the class. Extensions already present will be ignored.
	 */
	static withExtensions<E extends readonly Extension[]>(
		extensions: E,
	): typeof Provider & {
		new (
			config: ProviderOptions,
			options?: any,
		): Provider<E> & InferExtensions<E>;
	} {
		return class extends this<E> {
			static EXTENSIONS = extensions;
		} as any;
	}
}

export type BaseProvider<E extends readonly Extension[] = any[]> = Provider<E> &
	InferExtensions<E>;
