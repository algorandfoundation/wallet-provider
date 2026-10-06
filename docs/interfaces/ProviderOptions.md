[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / ProviderOptions

# Interface: ProviderOptions

Defined in: [src/types.ts:108](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L108)

Configuration options for a [Provider](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/classes/Provider.md).

## Example

```typescript
const config: ProviderOptions = {
  id: "my-provider",
  name: "My Wallet",
  icon: "https://example.com/icon.png",
  uri: "https://mywallet.com",
};
```

## Properties

| Property                           | Type              | Description                                                                 | Defined in                                                                                            |
| ---------------------------------- | ----------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| <a id="property-icon"></a> `icon?` | `string`          | Optional URL or data URI for the provider's icon.                           | [src/types.ts:120](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L120) |
| <a id="property-id"></a> `id`      | `string`          | Unique identifier for the provider.                                         | [src/types.ts:112](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L112) |
| <a id="property-name"></a> `name`  | `string`          | Human-readable name of the provider.                                        | [src/types.ts:116](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L116) |
| <a id="property-port"></a> `port?` | `number`          | Optional port number if the provider communicates over a specific port.     | [src/types.ts:128](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L128) |
| <a id="property-ssl"></a> `ssl?`   | `boolean`         | Whether to use SSL for communication.                                       | [src/types.ts:132](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L132) |
| <a id="property-uri"></a> `uri?`   | `string` \| `URL` | Optional base URI for the provider, used for deep linking or API discovery. | [src/types.ts:124](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L124) |
