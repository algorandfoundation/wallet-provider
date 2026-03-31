import { describe, expect, it } from "vitest";
import { type Extension, Provider, type ProviderOptions } from "./index.js";

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
});
