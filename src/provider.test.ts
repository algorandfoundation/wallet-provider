import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type BaseProvider,
  type Extension,
  type ExtensionOptions,
  Provider,
  type ProviderOptions,
} from "./index.js";

// This test file plays the role of the extension modules: it REGISTERS the
// option namespaces its fixture extensions claim on the single
// `ExtensionOptions` registry via declaration merging, exactly how a real
// extension package augments "@algorandfoundation/wallet-provider" (the merge
// works through the `export *` barrel).
declare module "./index.js" {
  interface ExtensionOptions {
    /** Seat the account extension fixture claims. */
    accounts?: boolean;
    /** Configuration the connections extension claims from its namespace. */
    connections?: { signalUrl?: string };
    /** Configuration the keystore extension claims from its namespace. */
    keystore?: { prefix?: string };
  }
}

describe("Provider", () => {
  it("should initialize with basic config", () => {
    const config: ProviderOptions = {
      id: "test-wallet",
      name: "Test Wallet",
      icon: "https://example.com/icon.png",
    };
    const wallet = new Provider(config);

    expect(wallet.id).toBe(config.id);
    expect(wallet.name).toBe(config.name);
    expect(wallet.icon).toBe(config.icon);
  });

  it("should apply extensions correctly", () => {
    // 1. Define an extension that adds logging capabilities
    type LoggerExtension = { log: (msg: string) => void };
    const withLogger: Extension<LoggerExtension> = (provider) => {
      return {
        log: (msg: string) => `[${provider.name}] ${msg}`,
      };
    };

    // 2. Define an extension that handles accounts (mock example). Its
    // `accounts` namespace is registered on the ExtensionOptions registry
    // (see the module augmentation at the top of this file), which types the
    // composed constructor's options parameter.
    type AccountExtension = { accounts: string[]; getAccounts: () => string[] };
    const withAccounts: Extension<AccountExtension> = (_provider, options: ExtensionOptions) => {
      const accounts = options.accounts ? ["address1", "address2"] : [];
      return {
        accounts: accounts,
        getAccounts: () => accounts,
      };
    };

    // 3. Create a specialized Provider class with these extensions
    const MyWalletProvider = Provider.withExtensions([withLogger, withAccounts]);

    // 4. Instantiate the provider
    const config: ProviderOptions = {
      id: "my-wallet",
      name: "My Wallet",
    };

    const wallet = new MyWalletProvider(config, {
      accounts: true,
    });

    // 5. Use the augmented functionality
    const accounts = wallet.getAccounts();
    expect(accounts).toEqual(["address1", "address2"]);
    expect(wallet.accounts).toEqual(["address1", "address2"]);
  });

  it("should fail fast when an extension returns a Promise", () => {
    // Extensions are applied synchronously in the constructor; merging a
    // pending Promise would silently discard the resolved surface, so async
    // extensions are rejected (for now) instead of producing a half-built
    // provider. Supporting them would require a standard bootstrap method.
    const withAsync: Extension<Promise<{ asyncData: string }>> = async () => {
      return { asyncData: "done" };
    };

    const AsyncProvider = Provider.withExtensions([withAsync]);

    expect(() => new AsyncProvider({ id: "async", name: "Async" })).toThrowError(
      new TypeError(
        'Extension for provider "async" returned a Promise. Extensions are applied synchronously; async extensions are not supported.',
      ),
    );
  });
});

describe("composed typing", () => {
  // Named surfaces, like real extensions declare; `Composed` flattens their
  // members into the single object type quick-info prints.
  interface LoggerExtension {
    log: (msg: string) => string;
  }
  const withLogger: Extension<LoggerExtension> = (provider) => ({
    log: (msg: string) => `[${provider.name}] ${msg}`,
  });

  interface AccountsExtension {
    accounts: string[];
    getAccounts: () => string[];
  }
  const withAccounts: Extension<AccountsExtension> = () => {
    const accounts = ["address1"];
    return {
      accounts,
      getAccounts: () => accounts,
    };
  };

  const EXTENSIONS = [withLogger, withAccounts] as const;
  const ComposedProvider = Provider.withExtensions(EXTENSIONS);
  const config: ProviderOptions = { id: "composed", name: "Composed" };

  it("surfaces every extension member on the composed instance", () => {
    const wallet = new ComposedProvider(config);

    // The instance type is the flattened merge of the Provider core and the
    // extension surfaces: one object carrying every member.
    expectTypeOf(wallet).toExtend<LoggerExtension>();
    expectTypeOf(wallet).toExtend<AccountsExtension>();
    expectTypeOf(wallet.log).toEqualTypeOf<(msg: string) => string>();
    expectTypeOf(wallet.getAccounts).returns.toEqualTypeOf<string[]>();

    expect(wallet.log("hello")).toBe("[Composed] hello");
    expect(wallet.getAccounts()).toEqual(["address1"]);
  });

  it("keeps the composed instance assignable to the bare Provider class", () => {
    const wallet = new ComposedProvider(config);

    // Bare `Provider` (no type argument) is a legal annotation thanks to the
    // defaulted phantom seat, no extensions tuple in the display.
    const bare: Provider = wallet;
    expectTypeOf(wallet).toExtend<Provider>();
    expect(bare.id).toBe("composed");
  });

  it("matches the BaseProvider helper shape", () => {
    const wallet = new ComposedProvider(config);
    expectTypeOf(wallet).toEqualTypeOf<BaseProvider<typeof EXTENSIONS>>();
  });

  it("preserves the extensions tuple on the class statics", () => {
    // The tuple stays on the statics (it never leaks into the instance type).
    expectTypeOf(ComposedProvider.EXTENSIONS).toExtend<typeof EXTENSIONS>();
    expect(ComposedProvider.EXTENSIONS).toBe(EXTENSIONS);
  });

  it("accepts any registered namespace: the registry is global, not per tuple", () => {
    // Options are typed by the single ExtensionOptions registry: every
    // namespace a module registers is legal on any composed provider (only
    // unregistered namespaces are rejected), even when the composing tuple
    // doesn't include that extension.
    const wallet = new ComposedProvider(config, { keystore: { prefix: "unused" } });
    expect(wallet.getAccounts()).toEqual(["address1"]);
  });
});

describe("composed typing: example-shaped fixture", () => {
  // Mirrors a real dapp's EXTENSIONS tuple: extensions with named return
  // surfaces, plus generic factories whose seats are pinned with
  // instantiation expressions (`WithAccountStore<Account>`-style). The
  // composed instance type must expand to ONE flat object (the Provider
  // core, each namespace (`connection`, `account`, `identity`, `key`), and
  // any state an extension adds to the global surface) with no
  // intersection chain and no extensions-tuple noise.
  interface ConnectionsExtension {
    connection: { connect: (protocolId: string) => string };
  }
  const withConnections: Extension<ConnectionsExtension> = (
    provider,
    options: ExtensionOptions,
  ) => ({
    connection: {
      connect: (protocolId: string) =>
        `${options.connections?.signalUrl ?? provider.id}:${protocolId}`,
    },
  });

  interface AccountStoreExtension<T> {
    account: { accounts: T[]; add: (account: T) => void };
  }
  const WithAccountStore = <T>(
    _provider: Provider<any> & Partial<ConnectionsExtension>,
    _options: any,
  ): AccountStoreExtension<T> => {
    const accounts: T[] = [];
    return { account: { accounts, add: (account: T) => accounts.push(account) } };
  };

  interface IdentityStoreExtension<T> {
    identity: { identities: T[]; add: (identity: T) => void };
  }
  const WithIdentityStore = <T>(
    _provider: Provider<any> & Partial<ConnectionsExtension>,
    _options: any,
  ): IdentityStoreExtension<T> => {
    const identities: T[] = [];
    return { identity: { identities, add: (identity: T) => identities.push(identity) } };
  };

  interface KeyStoreExtension {
    key: { generate: () => string };
    /** Reactive state the keystore adds to the GLOBAL surface (a live getter). */
    readonly keys: readonly string[];
  }
  const withKeyStore: Extension<KeyStoreExtension> = (_provider, options: ExtensionOptions) => {
    const prefix = options.keystore?.prefix ?? "key";
    const keys: string[] = [];
    return {
      key: {
        generate: () => {
          const id = `${prefix}-${keys.length + 1}`;
          keys.push(id);
          return id;
        },
      },
      get keys(): readonly string[] {
        return keys;
      },
    };
  };

  interface Account {
    address: string;
  }
  interface DappIdentity {
    did: string;
  }

  const EXTENSIONS = [
    withConnections,
    WithAccountStore<Account>,
    WithIdentityStore<DappIdentity>,
    withKeyStore,
  ] as const;
  const DappProvider = Provider.withExtensions(EXTENSIONS);
  const config: ProviderOptions = { id: "dapp", name: "Dapp" };

  it("pins the generic seats through the instantiation expressions", () => {
    const ctx = new DappProvider(config);

    expectTypeOf(ctx).toEqualTypeOf<BaseProvider<typeof EXTENSIONS>>();
    expectTypeOf(ctx.account.accounts).toEqualTypeOf<Account[]>();
    expectTypeOf(ctx.identity.identities).toEqualTypeOf<DappIdentity[]>();
    expectTypeOf(ctx.connection.connect).returns.toEqualTypeOf<string>();
    expectTypeOf(ctx.key.generate).returns.toEqualTypeOf<string>();

    ctx.account.add({ address: "addr1" });
    ctx.identity.add({ did: "did:key:z6Mk" });
    expect(ctx.account.accounts).toEqual([{ address: "addr1" }]);
    expect(ctx.identity.identities).toEqual([{ did: "did:key:z6Mk" }]);
    expect(ctx.connection.connect("liquid-auth")).toBe("dapp:liquid-auth");
    expect(ctx.key.generate()).toBe("key-1");
  });

  it("exposes extension state added to the global surface as a property", () => {
    const ctx = new DappProvider(config);

    // The keystore contributes top-level reactive state via a getter; on the
    // composed (flattened) type it reads as a `readonly` property of the class.
    expectTypeOf(ctx.keys).toEqualTypeOf<readonly string[]>();

    expect(ctx.keys).toEqual([]);
    const id = ctx.key.generate();
    expect(ctx.keys).toEqual([id]);
  });

  it("types the options with the single ExtensionOptions registry", () => {
    // The constructor's options parameter (and the instance's `options`
    // property) is the ONE `ExtensionOptions` interface, the registry every
    // extension module augments with its `options.<domain>` namespace, so it
    // renders as a single compact named type with everything on it:
    // `options?: ExtensionOptions`.
    type DappOptions = NonNullable<ConstructorParameters<typeof DappProvider>[1]>;
    expectTypeOf<DappOptions>().toEqualTypeOf<ExtensionOptions>();

    const ctx = new DappProvider(config, {
      connections: { signalUrl: "wss://signal" },
      keystore: { prefix: "vault" },
    });

    // The instance's `options` property carries the same named registry type.
    expectTypeOf(ctx.options).toEqualTypeOf<ExtensionOptions>();

    expect(ctx.connection.connect("liquid-auth")).toBe("wss://signal:liquid-auth");
    expect(ctx.key.generate()).toBe("vault-1");
  });

  it("rejects option namespaces no extension registers", () => {
    // The typed options signature is the single construct overload (the base
    // `options?: any` fallback is dropped), so namespaces missing from the
    // ExtensionOptions registry error instead of silently matching.
    // @ts-expect-error: no extension registers a `bogus` namespace
    const ctx = new DappProvider(config, { bogus: true });
    expect(ctx.options).toEqual({ bogus: true });
  });

  it("keeps the base constructor loose for the concrete-class pattern", () => {
    // `class X extends Provider` is the concrete-class pattern: the subclass
    // owns its option shape, so the BASE constructor intentionally accepts any
    // bag (`options?: ExtensionOptions | any`). Only `withExtensions` narrows
    // the signature to the registry.
    class ConcreteWallet extends Provider {
      readonly vaultName: string;
      constructor(cfg: ProviderOptions, options?: { vault?: { name: string } }) {
        super(cfg, options);
        this.vaultName = options?.vault?.name ?? "default";
      }
    }

    // Arbitrary, unregistered namespaces are accepted on the subclass and on
    // a direct `new Provider(...)`; no `@ts-expect-error` needed here.
    const wallet = new ConcreteWallet(config, { vault: { name: "cold" } });
    const base = new Provider(config, { bogus: true, anything: { goes: 1 } });

    type BaseOptions = ConstructorParameters<typeof Provider>[1];
    expectTypeOf<BaseOptions>().toBeAny();

    expect(wallet.vaultName).toBe("cold");
    expect(wallet.options).toEqual({ vault: { name: "cold" } });
    expect(base.options).toEqual({ bogus: true, anything: { goes: 1 } });
  });

  it("keeps the legacy annotation shapes legal", () => {
    const ctx = new DappProvider(config);

    // The annotation shapes downstream extension packages use today;
    // all must stay legal with the defaulted phantom seat.
    const bare: Provider = ctx;
    const anySeat: Provider<any> = ctx;
    const partialSurface: Provider<any> & Partial<ConnectionsExtension> = ctx;
    const explicitTuple: Provider<typeof EXTENSIONS> = ctx;

    // `ExtensionOptions` stays a legal base for the shapes downstream
    // packages use today: extending it (`interface FooOptions extends
    // ExtensionOptions`), intersecting it (`ExtensionOptions & FooOptions`),
    // and annotating bags of registered namespaces with the bare name.
    interface LegacyDomainOptions extends ExtensionOptions {
      migrations?: { auto?: boolean };
    }
    const legacyBag: ExtensionOptions = { keystore: { prefix: "vault" } };
    const legacyIntersection: ExtensionOptions & LegacyDomainOptions = { migrations: {} };

    expect([bare, anySeat, partialSurface, explicitTuple].every((p) => p === ctx)).toBe(true);
    expect([legacyBag, legacyIntersection].every((o) => typeof o === "object")).toBe(true);
  });
});
