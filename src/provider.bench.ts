import { bench, describe } from 'vitest';
import { Provider, type Extension, type ProviderOptions } from './index.js';

describe('Provider Benchmarks', () => {
  const config: ProviderOptions = {
    id: 'bench-wallet',
    name: 'Bench Wallet',
  };

  bench('instantiate base Provider', () => {
    new Provider(config);
  });

  const withLogger: Extension = (provider) => ({
    log: (msg: string) => `[${provider.name}] ${msg}`,
  });

  const withAccounts: Extension = (_provider, options) => ({
    getAccounts: () => (options.accounts ? ['a1', 'a2'] : []),
  });

  const ExtendedProvider = Provider.withExtensions([withLogger, withAccounts]);

  bench('instantiate ExtendedProvider', () => {
    new ExtendedProvider(config, { accounts: true });
  });

  const manyExtensions = Array.from({ length: 10 }, (_, i) => {
    const ext: Extension = () => ({ [`ext${i}`]: i });
    return ext;
  });

  const MultiExtendedProvider = Provider.withExtensions(manyExtensions);

  bench('instantiate Provider with 10 extensions', () => {
    new MultiExtendedProvider(config);
  });
});
