// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IMarketplace.sol";

contract MarketplaceMock is IMarketplace {

    function createProduct(bytes32 id, string memory name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds) override public {
        emit ProductCreated(msg.sender, id, name, beneficiary, pricePerSecond, currency, minimumSubscriptionSeconds);
    }

    function getSubscription(bytes32 productId, address subscriber) override public view returns (bool isValid, uint endTimestamp) {
        if (subscriber == msg.sender && productId == 0x0000000000000000000000000000000000000000000000000000000000000001) {
            return (true, block.timestamp + 60); // solhint-disable-line not-rely-on-time
        }
        return (false, 0);
    }

    function hasValidSubscription(bytes32 productId, address subscriber) override public view returns (bool isValid) {
        return subscriber == msg.sender && productId == 0x0000000000000000000000000000000000000000000000000000000000000001;
    }

    function getPriceInData(uint subscriptionSeconds, uint price, Currency unit) override public pure returns (uint datacoinAmount) {
        return subscriptionSeconds * price * (unit == Currency.USD ? 1 : 100);
    }

    function buy(bytes32 productId, uint subscriptionSeconds) override public {
        emit Subscribed(productId, msg.sender, block.timestamp + subscriptionSeconds); // solhint-disable-line not-rely-on-time
    }
}