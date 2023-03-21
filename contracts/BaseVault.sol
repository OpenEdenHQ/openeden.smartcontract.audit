// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "./interfaces/Action.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BaseVault is Ownable {
    uint256 _transactionFee;
    uint256 _firstDeposit;
    uint256 _minDeposit;
    uint256 _maxDeposit;
    uint256 _maxWithdraw;
    uint256 _targetReservesLevel;
    uint256 _onchainServiceFeeRate;
    uint256 _offchainServiceFeeRate;

    // event SetTransactionFeeWeekdayRate(uint256 transactionFeeWeekdayRate);
    // event SetTransactionFeeWeekendRate(uint256 transactionFeeWeekendRate);

    event SetTransactionFee(uint256 transactionFee);
    event SetFirsetDeposit(uint256 firstDeposit);
    event SetMinDeposit(uint256 minDeposit);
    event SetMaxDeposit(uint256 maxDeposit);
    event SetMaxWithdraw(uint256 maxWithdraw);
    event SetTargetReservesLevel(uint256 targetReservesLevel);
    event SetOnchainServiceFeeRate(uint256 onchainServiceFeeRate);
    event SetOffchainServiceFeeRate(uint256 offchainServiceFeeRate);
    event SetFirstDeposit(uint256 firstDeposit);

    constructor(
        uint256 transactionFee,
        uint256 firstDeposit,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 maxWithdraw,
        uint256 targetReservesLevel,
        uint256 onchainServiceFeeRate,
        uint256 offchainServiceFeeRate
    ) {
        // _params.transactionFeeWeekdayRate = params.transactionFeeWeekdayRate;
        // _params.transactionFeeWeekendRate = params.transactionFeeWeekendRate;
        _transactionFee = transactionFee;
        _firstDeposit = firstDeposit;
        _minDeposit = minDeposit;
        _maxDeposit = maxDeposit;
        _maxWithdraw = maxWithdraw;
        _targetReservesLevel = targetReservesLevel;
        _onchainServiceFeeRate = onchainServiceFeeRate;
        _offchainServiceFeeRate = offchainServiceFeeRate;
    }

    // function setTransactionFeeWeekdayRate(uint256 transactionFeeWeekdayRate) onlyAdminOrOperator whenPaused external {
    //     _params.transactionFeeWeekdayRate =  transactionFeeWeekdayRate;
    //     emit SetTransactionFeeWeekdayRate(transactionFeeWeekdayRate);
    // }

    // function setTransactionFeeWeekendRate(uint256 transactionFeeWeekendRate) onlyAdminOrOperator whenPaused external {
    //     _params.transactionFeeWeekendRate =  transactionFeeWeekendRate;
    //     emit SetTransactionFeeWeekendRate(transactionFeeWeekendRate);
    // }

    function setTransactionFee(uint256 transactionFee) external onlyOwner {
        _transactionFee = transactionFee;
        emit SetTransactionFee(transactionFee);
    }

    function setFirstDeposit(uint256 firstDeposit) external onlyOwner {
        _firstDeposit = firstDeposit;
        emit SetFirstDeposit(firstDeposit);
    }

    function setMinDeposit(uint256 minDeposit) external onlyOwner {
        _minDeposit = minDeposit;
        emit SetMinDeposit(minDeposit);
    }

    function setMaxDeposit(uint256 maxDeposit) external onlyOwner {
        _maxDeposit = maxDeposit;
        emit SetMaxDeposit(maxDeposit);
    }

    function setMaxWithdraw(uint256 maxWithdraw) external onlyOwner {
        _maxWithdraw = maxWithdraw;
        emit SetMaxWithdraw(maxWithdraw);
    }

    function setTargetReservesLevel(
        uint256 targetReservesLevel
    ) external onlyOwner {
        _targetReservesLevel = targetReservesLevel;
        emit SetTargetReservesLevel(targetReservesLevel);
    }

    function setOnchainServiceFeeRate(
        uint256 onchainServiceFeeRate
    ) external onlyOwner {
        _onchainServiceFeeRate = onchainServiceFeeRate;
        emit SetOnchainServiceFeeRate(onchainServiceFeeRate);
    }

    function setOffchainServiceFeeRate(
        uint256 offchainServiceFeeRate
    ) external onlyOwner {
        _offchainServiceFeeRate = offchainServiceFeeRate;
        emit SetOffchainServiceFeeRate(offchainServiceFeeRate);
    }

    function getTransactionFee() external view returns (uint256 txFee) {
        return _transactionFee;
    }

    function getMinMaxDeposit()
        external
        view
        returns (uint256 minDeposit, uint256 maxDeposit)
    {
        return (_minDeposit, _maxDeposit);
    }

    function getMaxWithdraw() external view returns (uint256 maxWithdraw) {
        return _maxWithdraw;
    }

    function getTargetReservesLevel()
        external
        view
        returns (uint256 targetReservesLevel)
    {
        return _targetReservesLevel;
    }

    function getOnchainAndOffChainServiceFeeRate()
        external
        view
        returns (uint256 onchainFeeRate, uint256 offchainFeeRate)
    {
        return (_onchainServiceFeeRate, _offchainServiceFeeRate);
    }

    function getFirstDeposit() external view returns (uint256 firstDeposit) {
        return _firstDeposit;
    }
}
