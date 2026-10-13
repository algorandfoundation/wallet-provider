[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / ExtensionOptions

# Interface: ExtensionOptions

Defined in: [src/types.ts:86](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L86)

The single provider options type: a declaration-merged registry every
extension module contributes its `options.<domain>` block to.

Extensions claim their configuration under `options.<domain>` blocks.
Instead of inferring the merge per extensions tuple (which erases the type
name in renders), each extension REGISTERS its options block on this interface
via module augmentation, so `ExtensionOptions` is one named type with
everything on it, and hovers print the compact name
(`options?: ExtensionOptions`) while autocomplete and go-to-definition
surface every registered namespace. Unregistered namespaces are rejected at
the call site.

## Example

```typescript
// In the extension module: register the namespace it claims:
declare module "@algorandfoundation/wallet-provider" {
  interface ExtensionOptions {
    connections?: { signalUrl?: string };
  }
}

// At the composition root: every registered namespace is typed:
const provider = new DappProvider(config, {
  connections: { signalUrl: "wss://signal" },
});
```
