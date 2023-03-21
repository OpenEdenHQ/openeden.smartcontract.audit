// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "../DoubleQueueModified.sol";

contract DoubleQueueTest {
    using DoubleQueueModified for DoubleQueueModified.BytesDeque;

    DoubleQueueModified.BytesDeque queue;

    function pushBack(address investor, uint256 shares) external {
        bytes memory data = abi.encode(investor, shares);
        queue.pushBack(data);
    }

    function popAll() external returns (address investor, uint256 shares) {
        for (; !queue.empty(); ) {
            bytes memory data = queue.popFront();
            (investor, shares) = abi.decode(data, (address, uint256));
        }
    }

    function getByIndex(
        uint256 index
    ) external view returns (address investor, uint256 shares) {
        bytes memory data = bytes(queue.at(index));
        (investor, shares) = abi.decode(data, (address, uint256));
    }

    function getLength() external view returns (uint256) {
        return queue.length();
    }
}
