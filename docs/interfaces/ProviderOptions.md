[Wallet Provider API Reference](https://github.com/algorandfoundation/wallet-provider/blob/main/docs/README.md) / ProviderOptions

# Interface: ProviderOptions

Defined in: [src/types.ts:109](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L109)

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
| <a id="property-icon"></a> `icon?` | `string`          | Optional URL or data URI for the provider's icon.                           | [src/types.ts:121](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L121) |
| <a id="property-id"></a> `id`      | `string`          | Unique identifier for the provider.                                         | [src/types.ts:113](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L113) |
| <a id="property-name"></a> `name`  | `string`          | Human-readable name of the provider.                                        | [src/types.ts:117](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L117) |
| <a id="property-port"></a> `port?` | `number`          | Optional port number if the provider communicates over a specific port.     | [src/types.ts:129](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L129) |
| <a id="property-ssl"></a> `ssl?`   | `boolean`         | Whether to use SSL for communication.                                       | [src/types.ts:133](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L133) |
| <a id="property-uri"></a> `uri?`   | `string` \| `URL` | Optional base URI for the provider, used for deep linking or API discovery. | [src/types.ts:125](https://github.com/algorandfoundation/wallet-provider/blob/main/src/types.ts#L125) |
