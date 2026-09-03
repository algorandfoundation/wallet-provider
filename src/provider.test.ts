import { describe, expect, it } from "vitest";
import {
  type Extension,
  ExtensionCollisionError,
  LOCKED_PROVIDER_KEYS,
  Provider,
  type ProviderOptions,
  RESERVED_PROVIDER_KEYS,
} from "./index.js";

const catchError = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw, but it did not");
};

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

    // 2. Define an extension that handles accounts (mock example)
    type AccountExtension = { accounts: string[]; getAccounts: () => string[] };
    const withAccounts: Extension<AccountExtension> = (_provider, options) => {
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

  it("should handle async extensions", async () => {
    const withAsync: Extension<{ asyncData: string }> = async () => {
      return { asyncData: "done" };
    };

    const AsyncProvider = Provider.withExtensions([withAsync]);
    // Note: The current constructor doesn't wait for async extensions.
    // Based on src/types.ts: constructor calls ext(this, this.options) and does Object.assign(this, result)
    // If result is a promise, it will assign the promise to 'this'.
    // Let's verify this behavior.

    const wallet = new AsyncProvider({ id: "async", name: "Async" });

    // The extension returns a Promise, and Object.assign(this, Promise) does nothing useful
    // because Promise properties are not enumerable.
    // However, if we want to support async extensions, we will need to introduce a standard bootstrap method for extensions.
    // For now, let's just check that it doesn't crash and see what it actually does.

    expect(wallet.asyncData).toBeUndefined();
  });

  describe("composition safety", () => {
    const config: ProviderOptions = {
      id: "base-wallet",
      name: "Base Wallet",
      icon: "https://base.example/icon.png",
      uri: "https://base.example",
    };

    describe("reserved and locked base properties", () => {
      it.each([...RESERVED_PROVIDER_KEYS].map(String))(
        "rejects an extension that contributes reserved key %s",
        (reserved) => {
          const hostile: Extension<Record<string, string>> = () => ({ [reserved]: "attacker" });
          const HostileProvider = Provider.withExtensions([hostile]);

          const error = catchError(() => new HostileProvider(config));

          expect(error).toBeInstanceOf(ExtensionCollisionError);
          expect((error as ExtensionCollisionError).property).toBe(reserved);
        },
      );

      it.each([...LOCKED_PROVIDER_KEYS].map(String))(
        "locks %s against mutation after construction",
        (locked) => {
          const ComposedProvider = Provider.withExtensions([() => ({})]);
          const wallet = new ComposedProvider(config);
          const before = (wallet as unknown as Record<string, unknown>)[locked];

          expect(() => {
            (wallet as unknown as Record<string, unknown>)[locked] = "attacker";
          }).toThrow(TypeError);
          expect((wallet as unknown as Record<string, unknown>)[locked]).toBe(before);
        },
      );

      it("leaves a bare provider without extensions as a plain data object", () => {
        // Deliberate fast path: with no extensions, no third-party code runs
        // during construction, so the instance is not locked or frozen.
        const wallet = new Provider(config);

        (wallet as { name: string }).name = "renamed";

        expect(wallet.name).toBe("renamed");
      });

      it("locks base identity against direct mutation by an extension", () => {
        const hostile: Extension<object> = (provider) => {
          provider.id = "attacker";
          return {};
        };
        const HostileProvider = Provider.withExtensions([hostile]);

        expect(() => new HostileProvider(config)).toThrow(TypeError);
      });

      it("keeps JSON.stringify reporting the locked identity", () => {
        const ComposedProvider = Provider.withExtensions([() => ({})]);
        const wallet = new ComposedProvider(config);

        expect(JSON.parse(JSON.stringify(wallet)).id).toBe(config.id);
      });
    });

    describe("collision rejection", () => {
      it("rejects a later extension that shadows an earlier extension's capability", () => {
        const withLog: Extension<{ log: () => string }> = () => ({ log: () => "genuine" });
        const withShadowedLog: Extension<{ log: () => string }> = () => ({
          log: () => "attacker",
        });
        const CollidingProvider = Provider.withExtensions([withLog, withShadowedLog]);

        const error = catchError(() => new CollidingProvider(config));

        expect(error).toBeInstanceOf(ExtensionCollisionError);
        expect((error as ExtensionCollisionError).property).toBe("log");
      });

      it("rejects shadowing of inherited prototype members", () => {
        const hostile: Extension<object> = () => ({ toString: () => "attacker" });
        const HostileProvider = Provider.withExtensions([hostile]);

        expect(() => new HostileProvider(config)).toThrow(ExtensionCollisionError);
      });

      it("detects collisions on symbol-keyed properties", () => {
        const capability = Symbol("capability");
        const first: Extension<object> = () => ({ [capability]: () => "genuine" });
        const second: Extension<object> = () => ({ [capability]: () => "attacker" });
        const CollidingProvider = Provider.withExtensions([first, second]);

        const error = catchError(() => new CollidingProvider(config));

        expect(error).toBeInstanceOf(ExtensionCollisionError);
        expect((error as ExtensionCollisionError).property).toBe(capability);
      });
    });

    describe("namespace merging", () => {
      it("merges a re-returned domain namespace that shares the same store", () => {
        // The WithIdentityStore / WithIdentitiesKeystore idiom from
        // wallet-provider-extensions: the later extension augments the shared
        // store in place and re-returns it under the same domain key.
        const store = { list: [] as string[] };
        const withIdentityStore: Extension<{ identity: { store: typeof store } }> = () => ({
          identity: { store },
        });
        const withIdentitiesKeystore: Extension<object> = (provider) => ({
          identity: {
            store: Object.assign(provider.identity?.store ?? {}, {
              restore: () => "restored",
            }),
          },
        });
        const ComposedProvider = Provider.withExtensions([
          withIdentityStore,
          withIdentitiesKeystore,
        ]);

        const wallet = new ComposedProvider(config);

        expect(wallet.identity.store).toBe(store);
        expect((wallet.identity.store as { restore?: () => string }).restore?.()).toBe("restored");
      });

      it("keeps the extend-or-create branch reachable when the namespace is absent", () => {
        const withIdentitiesKeystore: Extension<{
          identity: { store: { restore: () => string } };
        }> = (provider) => ({
          identity: {
            store: Object.assign(provider.identity?.store ?? {}, {
              restore: () => "restored",
            }),
          },
        });
        const ComposedProvider = Provider.withExtensions([withIdentitiesKeystore]);

        const wallet = new ComposedProvider(config);

        expect(wallet.identity.store.restore()).toBe("restored");
      });

      it("merges disjoint keys from both namespaces, recursing into nested plain objects", () => {
        const first: Extension<object> = () => ({ api: { a: 1, nested: { x: 1 } } });
        const second: Extension<object> = () => ({ api: { b: 2, nested: { y: 2 } } });
        const ComposedProvider = Provider.withExtensions([first, second]);

        const wallet = new ComposedProvider(config);

        expect(wallet.api).toEqual({ a: 1, b: 2, nested: { x: 1, y: 2 } });
      });

      it("rejects a merge that would change a leaf value", () => {
        const first: Extension<object> = () => ({ api: { a: 1 } });
        const second: Extension<object> = () => ({ api: { a: 2 } });
        const CollidingProvider = Provider.withExtensions([first, second]);

        const error = catchError(() => new CollidingProvider(config));

        expect(error).toBeInstanceOf(ExtensionCollisionError);
        expect((error as ExtensionCollisionError).property).toBe("api");
        expect((error as Error).message).toContain("api.a");
      });

      it("rejects accessors inside a merged namespace", () => {
        const first: Extension<object> = () => ({ api: { a: 1 } });
        const second: Extension<object> = () => ({
          api: {
            get b(): number {
              return 2;
            },
          },
        });
        const CollidingProvider = Provider.withExtensions([first, second]);

        expect(() => new CollidingProvider(config)).toThrow(ExtensionCollisionError);
      });

      it("rejects a merge into a non-extensible namespace", () => {
        const first: Extension<object> = () => ({ api: Object.freeze({ a: 1 }) });
        const second: Extension<object> = () => ({ api: { b: 2 } });
        const CollidingProvider = Provider.withExtensions([first, second]);

        const error = catchError(() => new CollidingProvider(config));

        expect(error).toBeInstanceOf(ExtensionCollisionError);
      });

      it("does not merge non-plain objects even under the same key", () => {
        class Store {}
        const first: Extension<object> = () => ({ api: new Store() });
        const second: Extension<object> = () => ({ api: new Store() });
        const CollidingProvider = Provider.withExtensions([first, second]);

        expect(() => new CollidingProvider(config)).toThrow(ExtensionCollisionError);
      });

      it("accepts a re-returned identical value as a no-op", () => {
        const log = (): string => "log";
        const first: Extension<object> = () => ({ log });
        const second: Extension<object> = () => ({ log });
        const ComposedProvider = Provider.withExtensions([first, second]);

        const wallet = new ComposedProvider(config);

        expect(wallet.log()).toBe("log");
      });
    });

    describe("sealed contributions", () => {
      it("seals contributed properties against reassignment and redefinition", () => {
        const withLog: Extension<{ log: () => string }> = () => ({ log: () => "genuine" });
        const ComposedProvider = Provider.withExtensions([withLog]);
        const wallet = new ComposedProvider(config);

        expect(() => {
          wallet.log = () => "attacker";
        }).toThrow(TypeError);
        expect(() => {
          Object.defineProperty(wallet, "log", { value: () => "attacker" });
        }).toThrow(TypeError);
        expect(wallet.log()).toBe("genuine");
      });

      it("blocks a later extension from reassigning an earlier capability through the instance", () => {
        const withLog: Extension<{ log: () => string }> = () => ({ log: () => "genuine" });
        const hostile: Extension<object> = (provider) => {
          provider.log = () => "attacker";
          return {};
        };
        const HostileProvider = Provider.withExtensions([withLog, hostile]);

        expect(() => new HostileProvider(config)).toThrow(TypeError);
      });

      it("preserves live getter contributions", () => {
        const state = { list: ["a"] };
        const withAccounts: Extension<{ accounts: string[] }> = () => ({
          get accounts() {
            return state.list;
          },
        });
        const ComposedProvider = Provider.withExtensions([withAccounts]);

        const wallet = new ComposedProvider(config);
        state.list = ["a", "b"];

        expect(wallet.accounts).toEqual(["a", "b"]);
      });
    });

    it("freezes merged options after construction", () => {
      const ComposedProvider = Provider.withExtensions([() => ({})]);
      const wallet = new ComposedProvider(config, { accounts: true });

      expect(() => {
        (wallet as { options: object }).options = {};
      }).toThrow(TypeError);
      expect(() => {
        (wallet.options as { injected?: boolean }).injected = true;
      }).toThrow(TypeError);
    });

    it("still composes disjoint extensions in order", () => {
      const withMigrations: Extension<{ migrations: string[] }> = () => ({ migrations: [] });
      const withRegistrant: Extension<object> = (provider) => {
        provider.migrations.push("registered");
        return {};
      };
      const ComposedProvider = Provider.withExtensions([withMigrations, withRegistrant]);

      const wallet = new ComposedProvider(config);

      expect(wallet.migrations).toEqual(["registered"]);
    });
  });
});
