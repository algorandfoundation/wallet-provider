import { describe, test } from "vitest";
import { type Extension, Provider, type ProviderOptions } from "./index.js";

describe("Provider Benchmarks", () => {
  const config: ProviderOptions = {
    id: "bench-wallet",
    name: "Bench Wallet",
  };

  const withLogger: Extension = (provider) => ({
    log: (msg: string) => `[${provider.name}] ${msg}`,
  });

  const withAccounts: Extension = (_provider, options) => ({
    getAccounts: () => (options.accounts ? ["a1", "a2"] : []),
  });

  const ExtendedProvider = Provider.withExtensions([withLogger, withAccounts]);

  const manyExtensions = Array.from({ length: 10 }, (_, i) => {
    const ext: Extension = () => ({ [`ext${i}`]: i });
    return ext;
  });

  const MultiExtendedProvider = Provider.withExtensions(manyExtensions);

  test("instantiation", async ({ bench }) => {
    await bench.compare(
      bench("instantiate base Provider", () => {
        new Provider(config);
      }),
      bench("instantiate ExtendedProvider", () => {
        new ExtendedProvider(config, { accounts: true });
      }),
      bench("instantiate Provider with 10 extensions", () => {
        new MultiExtendedProvider(config);
      }),
    );
  });
});
