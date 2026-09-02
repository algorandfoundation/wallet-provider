import { describe, expect, it } from "vitest";
import {
  type Extension,
  ExtensionCollisionError,
  Provider,
  type ProviderOptions,
} from "./index.js";

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
      uri: "https://base.example",
    };

    it.each(["id", "name", "icon", "uri", "options"])(
      "rejects an extension that shadows base %s",
      (reserved) => {
        const hostile: Extension<Record<string, string>> = () => ({ [reserved]: "attacker" });
        const HostileProvider = Provider.withExtensions([hostile]);

        expect(() => new HostileProvider(config)).toThrow(ExtensionCollisionError);
        expect(() => new HostileProvider(config)).toThrow(reserved);
      },
    );

    it("rejects a later extension that shadows an earlier extension's capability", () => {
      const withKey: Extension<{ key: string }> = () => ({ key: "genuine" });
      const withShadowedKey: Extension<{ key: string }> = () => ({ key: "attacker" });
      const CollidingProvider = Provider.withExtensions([withKey, withShadowedKey]);

      expect(() => new CollidingProvider(config)).toThrow(ExtensionCollisionError);
      expect(() => new CollidingProvider(config)).toThrow("key");
    });

    it("detects collisions on symbol-keyed properties", () => {
      const capability = Symbol("capability");
      const first: Extension<object> = () => ({ [capability]: "genuine" });
      const second: Extension<object> = () => ({ [capability]: "attacker" });
      const CollidingProvider = Provider.withExtensions([first, second]);

      expect(() => new CollidingProvider(config)).toThrow(ExtensionCollisionError);
    });

    it("allows a collision that is declared in allowOverrides", () => {
      const withLog: Extension<{ log: () => string }> = () => ({ log: () => "first" });
      const withBetterLog: Extension<{ log: () => string }> = () => ({ log: () => "second" });
      const OverridingProvider = Provider.withExtensions([withLog, withBetterLog], {
        allowOverrides: ["log"],
      });

      const wallet = new OverridingProvider(config);

      expect(wallet.log()).toBe("second");
    });

    it("never allows overriding base properties, even when declared", () => {
      const hostile: Extension<{ id: string }> = () => ({ id: "attacker" });
      const HostileProvider = Provider.withExtensions([hostile], { allowOverrides: ["id"] });

      expect(() => new HostileProvider(config)).toThrow(ExtensionCollisionError);
    });

    it("locks base identity against direct mutation by an extension", () => {
      const hostile: Extension<object> = (provider) => {
        provider.id = "attacker";
        return {};
      };
      const HostileProvider = Provider.withExtensions([hostile]);

      expect(() => new HostileProvider(config)).toThrow(TypeError);
    });

    it("locks base identity against mutation after construction", () => {
      const wallet = new Provider(config);

      expect(() => {
        (wallet as { id: string }).id = "attacker";
      }).toThrow(TypeError);
      expect(() => {
        (wallet as { name: string }).name = "attacker";
      }).toThrow(TypeError);
      expect(() => {
        (wallet as { uri: string }).uri = "https://attacker.example";
      }).toThrow(TypeError);
      expect(wallet.id).toBe(config.id);
    });

    it("freezes merged options after construction", () => {
      const wallet = new Provider(config, { accounts: true });

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
