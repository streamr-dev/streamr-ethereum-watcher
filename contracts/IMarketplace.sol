// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IMarketplace {
    enum ProductState {
        NotDeployed,                // non-existent or deleted
        Deployed                    // created or redeployed
    }

    enum Currency {
        DATA,                       // "token wei" (10^-18 DATA)
        USD                         // attodollars (10^-18 USD)
    }

    enum WhitelistState{
        None,
        Pending,
        Approved,
        Rejected
    }

    function createProduct(
        bytes32 id,
        string memory name,
        address beneficiary,
        uint pricePerSecond,
        Currency currency,
        uint minimumSubscriptionSeconds
    ) external;

    // product events
    event ProductCreated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductUpdated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductDeleted(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductImported(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductRedeployed(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductOwnershipOffered(address indexed owner, bytes32 indexed id, address indexed to);
    event ProductOwnershipChanged(address indexed newOwner, bytes32 indexed id, address indexed oldOwner);

    // subscription events
    event Subscribed(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event NewSubscription(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionExtended(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionImported(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionTransferred(bytes32 indexed productId, address indexed from, address indexed to, uint secondsTransferred);

    // currency events
    // event ExchangeRatesUpdated(uint timestamp, uint dataInUsd);

    // whitelist events
    event WhitelistRequested(bytes32 indexed productId, address indexed subscriber);
    event WhitelistApproved(bytes32 indexed productId, address indexed subscriber);
    event WhitelistRejected(bytes32 indexed productId, address indexed subscriber);
    event WhitelistEnabled(bytes32 indexed productId);
    event WhitelistDisabled(bytes32 indexed productId);

    // txFee events
    event TxFeeChanged(uint256 indexed newTxFee);

    function getSubscription(bytes32 productId, address subscriber) external view returns (bool isValid, uint endTimestamp);
    function hasValidSubscription(bytes32 productId, address subscriber) external view returns (bool isValid);

    // TODO: rename to getPrice? Clearly one of the arguments is the Currency...
    // TODO: make it handle different tokens (exchange rates e.g. from Uniswap)
    function getPriceInData(uint subscriptionSeconds, uint price, Currency unit) external view returns (uint datacoinAmount);

    function buy(bytes32 productId, uint subscriptionSeconds) external;
}
