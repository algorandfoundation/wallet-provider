import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type BaseProvider,
  type Extension,
  type ExtensionOptions,
  extendNamespace,
  MountError,
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
    /** A block with several fields, to exercise the DEFAULTS merge. */
    retry?: { max?: number; delay?: number };
  }
  interface Namespaces {
    /** The namespace the collision fixtures share. */
    vault: { store?: { label: string }; audit?: { log: string[] } };
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
        'Extension "withAsync" for provider "async" returned a Promise. Extensions are applied synchronously; async extensions are not supported.',
      ),
    );
  });

  it("names the extension that returns something other than an object", () => {
    const WithNothing = (() => undefined) as unknown as Extension;
    const WithNumber = (() => 42) as unknown as Extension;

    expect(() => new (Provider.withExtensions([WithNothing]))({ id: "p", name: "P" })).toThrowError(
      new TypeError(
        'Extension "WithNothing" for provider "p" returned undefined; an extension must return an object (return {} to contribute nothing).',
      ),
    );
    expect(() => new (Provider.withExtensions([WithNumber]))({ id: "p", name: "P" })).toThrow(
      /^Extension "WithNumber" for provider "p" returned number;/,
    );
  });

  it("carries port and ssl from the config", () => {
    const wallet = new Provider({ id: "p", name: "P", port: 8443, ssl: true });

    expect(wallet.port).toBe(8443);
    expect(wallet.ssl).toBe(true);
    expect(new Provider({ id: "p", name: "P" }).port).toBeUndefined();
  });
});

describe("options and DEFAULTS", () => {
  const config: ProviderOptions = { id: "defaults", name: "Defaults" };

  class WithDefaults extends Provider {
    static DEFAULTS = { retry: { max: 3, delay: 100 }, flag: true };
  }

  it("merges an options block over the matching DEFAULTS block, key by key", () => {
    const wallet = new WithDefaults(config, { retry: { max: 5 } });

    // A one-level spread would drop `delay`; the block merge keeps it.
    expect(wallet.options).toEqual({ retry: { max: 5, delay: 100 }, flag: true });
  });

  it("never shares DEFAULTS blocks between instances", () => {
    const first = new WithDefaults(config);
    const second = new WithDefaults(config);

    expect(first.options).not.toBe(WithDefaults.DEFAULTS);
    expect((first.options as any).retry).not.toBe(WithDefaults.DEFAULTS.retry);
    expect((first.options as any).retry).not.toBe((second.options as any).retry);

    (first.options as any).retry.max = 99;
    expect((second.options as any).retry.max).toBe(3);
    expect(WithDefaults.DEFAULTS.retry.max).toBe(3);
  });

  it("passes injected instances through by reference and lets a caller replace a block", () => {
    class Store {
      state = { keys: [] as string[] };
    }
    const shared = new Store();
    class WithStore extends Provider {
      static DEFAULTS = { keystore: { store: shared }, retry: { max: 3 } };
    }
    const mine = new Store();

    const defaults = new WithStore(config);
    const overridden = new WithStore(config, { keystore: { store: mine }, retry: null });

    // The default `Store` is not cloned (an instance, not a plain block)...
    expect((defaults.options as any).keystore.store).toBe(shared);
    // ...the caller's instance wins when given, and a non-object value
    // replaces the block outright.
    expect((overridden.options as any).keystore.store).toBe(mine);
    expect((overridden.options as any).retry).toBeNull();
  });
});

describe("extension collisions", () => {
  const config: ProviderOptions = { id: "p1", name: "Wallet" };
  const construct = (extensions: readonly Extension[]) => () =>
    new (Provider.withExtensions(extensions))(config);

  it("refuses to redefine a core Provider property", () => {
    for (const key of ["id", "name", "icon", "uri", "port", "ssl", "options"]) {
      const Hijack = (() => ({ [key]: "hijacked" })) as Extension;
      Object.defineProperty(Hijack, "name", { value: "Hijack" });

      expect(construct([Hijack])).toThrow(MountError);
      expect(construct([Hijack])).toThrow(
        `Extension "Hijack" for provider "p1" redefines "${key}", a core Provider property.`,
      );
    }
    // A getter is a redefinition too.
    const GetterHijack = (() => ({
      get id() {
        return "hijacked";
      },
    })) as Extension;
    expect(construct([GetterHijack])).toThrow(MountError);
  });

  it("refuses to redefine a property an earlier extension mounted", () => {
    const WithA = (() => ({ x: "from A" })) as Extension;
    const WithB = (() => ({ x: "from B" })) as Extension;
    const WithGetter = (() => ({
      get x() {
        return "getter";
      },
    })) as Extension;
    const symbol = Symbol("tag");
    const WithSymbol = (() => ({ [symbol]: 1 })) as Extension;
    const WithOtherSymbol = (() => ({ [symbol]: 2 })) as Extension;

    expect(construct([WithA, WithB])).toThrow(MountError);
    expect(construct([WithA, WithB])).toThrow(
      'Extension "WithB" for provider "p1" redefines "x", already mounted by an earlier extension. Use extendNamespace to add to a namespace another extension mounted.',
    );
    // Accessors collide in both directions, and symbol keys are checked too.
    expect(construct([WithA, WithGetter])).toThrow(MountError);
    expect(construct([WithGetter, WithA])).toThrow(MountError);
    expect(construct([WithSymbol, WithOtherSymbol])).toThrow(/Symbol\(tag\)/);
    // The same value placed twice is not a collision.
    const shared = { label: "shared" };
    const WithShared = (() => ({ shared })) as Extension;
    expect(construct([WithShared, WithShared])).not.toThrow();
  });

  it("lets several extensions extend one namespace, but not replace it", () => {
    const WithStore = ((provider) =>
      extendNamespace(provider, "vault", { store: { label: "local" } })) satisfies Extension;
    const WithAudit = ((provider) =>
      extendNamespace(provider, "vault", { audit: { log: [] } })) satisfies Extension;
    const Replace = (() => ({ vault: { store: { label: "other" } } })) as Extension;

    const wallet = construct([WithStore, WithAudit])();
    expect((wallet as any).vault).toEqual({ store: { label: "local" }, audit: { log: [] } });

    // A fresh object under the namespace key shadows the first extension's
    // surface: that is the collision the check is for.
    expect(construct([WithStore, Replace])).toThrow(MountError);
    expect(construct([WithStore, Replace])).toThrow(/redefines "vault"/);
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
    // The static is a copy: the caller's array is never mutated or aliased.
    expectTypeOf(ComposedProvider.EXTENSIONS).toEqualTypeOf<typeof EXTENSIONS>();
    expect(ComposedProvider.EXTENSIONS).toEqual(EXTENSIONS);
    expect(ComposedProvider.EXTENSIONS).not.toBe(EXTENSIONS);
  });

  it("chains: a second withExtensions applies the first list, then the new one", () => {
    interface AuditExtension {
      audit: { entries: string[] };
    }
    const withAudit: Extension<AuditExtension> = (provider) => {
      // Depends on the parent's extensions: both already applied.
      const parent = provider as unknown as LoggerExtension & AccountsExtension;
      return { audit: { entries: [parent.log("ready"), ...parent.getAccounts()] } };
    };

    const Chained = ComposedProvider.withExtensions([withAudit]);
    const wallet = new Chained(config);

    expectTypeOf(Chained.EXTENSIONS).toEqualTypeOf<
      readonly [typeof withLogger, typeof withAccounts, typeof withAudit]
    >();
    expectTypeOf(wallet).toExtend<LoggerExtension & AccountsExtension & AuditExtension>();
    expect(Chained.EXTENSIONS).toEqual([withLogger, withAccounts, withAudit]);
    expect(ComposedProvider.EXTENSIONS).toEqual([withLogger, withAccounts]);
    expect(wallet.audit.entries).toEqual(["[Composed] ready", "address1"]);
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
    // extension module augments with its `options.<domain>` block, so it
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
