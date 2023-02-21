// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ERC4626.sol";
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "hardhat/console.sol";


contract OpenEdenVault is ERC4626, Ownable, Pausable, ReentrancyGuard, ChainlinkClient {
    using Chainlink for Chainlink.Request;
    using Math for uint256;
    using Counters for Counters.Counter;
    Counters.Counter private _epochCounter;
    uint256 private _queueCounter;
    WithdrawalQueue public _withdrawalQueue; // withdrawal queue

    struct VaultParameters {
        uint256 transactionFee; // 5 bps
        uint256 transactionFeeWeekdayRate; // 5 bps
        uint256 transactionFeeWeekendRate; // 10 bps
        uint256 firstDeposit; // first deposit amount
        uint256 minDeposit; // 100000 USDC
        uint256 maxDeposit; // max deposit on a day
        uint256 maxWithdraw; // max withdraw on a day
        uint256 targetReservesLevel; // 10%
        uint256 managementFeeRate; // 40 bps
        uint256 decimals;
    }

    struct ChainlinkParameters {
        bytes32 jobId;
        uint256 fee;
        string urlData;
        string pathToOffchainAssets;
        string pathToTotalOffchainAssetAtLastClose;
    }

    struct RequestData {
        address investor;
        uint256 amount;
        Action action;
    }

    struct WithdrawalQueue {
        uint256 last;
        uint256 first;
        mapping(uint256 => WithdrawalInfo) items;
    }

    struct WithdrawalInfo {
        address investor;
        uint256 shares;
        uint256 index;
    }
    enum Action { Deposit, Withdraw, EpochUpdate, WithdrawalQueue }

    ChainlinkParameters public _chainLinkParameters;

    uint256 public immutable bpsUnit = 10000;
    uint256 public _exchangeRateDecimal;
    uint256 public _minTxsFee;
    VaultParameters public _vaultParameters; // parameters in vault
    address public _feeTo; // address receive service fee
    uint256 public _feeClaimable; // available amount admin can redeem 
    address public _operatorAddress; // address of the operator
    uint256 public _epoch; // epoch
    address public _coinbaseAccount; // coinbase account
    mapping(uint256 => uint256) public _totalOffchainAssets; // offchain assets update fron centralize server
    mapping(uint256 => uint256) public _totalOEAssets; // epoch => totalOEAssets
    mapping(uint256 => uint256) public _exchangeRate; // offchain assets update fron centralize server

    mapping (bytes32 => RequestData) public _requestIdToRequestData; // requestId => RequestData

    mapping(address => bool) public _isWhitelist; // check investor whitelist or not
    mapping(uint256 => uint256) public _dailyManagementFee; //   TVL * (managementFeeRate/365)
    mapping(address => mapping(uint256 => uint256)) public _depositAmount; // account => [epoch => depositAmount]
    mapping(address => mapping(uint256 => uint256)) public _withdrawAmount; // account => [epoch => depositAmount]
    mapping(address => bool) public _firstDeposit;
    // events
    event UpdateMinTxsFee(uint256 newValue);
    event UpdateCoinbaseAccount(address newAddress);
    event WhiteListInvestor(address investor, bool status);
    event RemoveWhilelist(address investor);
    event SetTransactionFee(uint256 transactionFee);
    event SetTransactionFeeWeekdayRate(uint256 transactionFeeWeekdayRate);
    event SetTransactionFeeWeekendRate(uint256 transactionFeeWeekendRate);
    event SetFirstDeposit(uint256 firstDeposit);
    event SetMinDeposit(uint256 minDeposit);
    event SetMaxDeposit(uint256 maxDeposit);
    event SetMaxWithdraw(uint256 maxWithdraw);
    event SetTargetReservesLevel(uint256 targetReservesLevel);
    event SetManagementFeeRate(uint256 managementFeeRate);
    event SetDecimals(uint256 decimals);
    event ClaimManagementFee(address receiver, uint256 amount);
    event SetFeeTo(address feeTo);
    event UpdateEpochData(uint256 totalOEAssets, uint256 dailyManagementFee, uint256 totalOffchainAssets, uint256 transactionFee, uint256 feeClaimable, uint256 exchangeRate, uint256 epoch, bytes32 requestId);
    event NewOperatorAddress(address operator);
    event Pause(address caller);
    event Unpause(address caller);
    event UpdateQueueWithdrawal(address investor, uint256 shares, uint256 index, bytes32 requestId);
    event ProcessWithdrawalQueue(address investor, uint256 assets, uint256 shares, uint256 exchangeRate, uint256 index, bytes32 requestId);
    event FundTBillPurchase(address coinbaseAccount, uint256 assets);
    event ProcessWithdraw(address receiver, uint256 assets, uint256 shares, uint256 exchangeRate, bytes32 requestId, uint256 subAssets, uint256 subShare);
    event RedeemVault(address receiver, uint256 assets, uint256 shares);
    event SetChainlinkTokenAddress(address newAddress);
    event SetChainlinkOracleAddress(address newAddress);
    event ProcessDeposit(address receiver, uint256 assets, uint256 shares,
        uint256 exchangeRate, bytes32 requestId, uint256 txsFee, address feeTo);
    event RequestUpdateEpoch(address caller, bytes32 requestId);
    event RequestWithdrawalQueue(address caller, bytes32 requestId);
    event RequestDeposit(address receiver, uint256 assets, bytes32 requestId);
    event RequestWithdraw(address receiver, uint256 shares, bytes32 requestId);
    event Fulfill(address investor, bytes32 requestId, uint256 totalOffChainAssets, uint256 exchangeRate, uint256 amount, Action action);
    event UpdateExchangeRateDecimal(uint256 exchangeRateDecimal);
    event WithdrawVault(address receiver, uint256 assets, uint256 shares, uint256 exchangeRate, bytes32 requestId);
    event SetChainlinkURLData(string url);
    event SetPathToOffchainAssets(string path);
    event SetPathToTotalOffchainAssetAtLastClose(string path);
    event SetChainlinkJobId(bytes32 jobId);
    event SetChainlinkFee(uint256 fee);


    // constructor 
    constructor (
        address asset_,
        address operatorAddress,
        address feeTo,
        address coinbaseAccount, // coinbase account
        VaultParameters memory vaultParams,
        ChainlinkParameters memory chainlinkParams,
        address chainlinkToken,
        address chainlinkOracle
    ) ERC4626(IERC20Metadata(asset_)) ERC20("OpenEden T-Bills", "TBILL")
    {
        require(coinbaseAccount != address(0) && feeTo != address(0) , "invalid parameters");
        setChainlinkOracle(chainlinkOracle);
        setChainlinkToken(chainlinkToken);
        _chainLinkParameters.fee = chainlinkParams.fee;
        _chainLinkParameters.jobId = chainlinkParams.jobId;
        _chainLinkParameters.urlData = chainlinkParams.urlData;
        _chainLinkParameters.pathToOffchainAssets = chainlinkParams.pathToOffchainAssets;
        _chainLinkParameters.pathToTotalOffchainAssetAtLastClose = chainlinkParams.pathToTotalOffchainAssetAtLastClose;

        _vaultParameters.transactionFeeWeekdayRate = vaultParams.transactionFeeWeekdayRate;
        _vaultParameters.transactionFeeWeekendRate = vaultParams.transactionFeeWeekendRate;
        _vaultParameters.transactionFee = isWeekday() 
        ? _vaultParameters.transactionFeeWeekdayRate
        : _vaultParameters.transactionFeeWeekendRate;
        _vaultParameters.minDeposit = vaultParams.minDeposit;
        _vaultParameters.maxDeposit = vaultParams.maxDeposit;
        _vaultParameters.maxWithdraw = vaultParams.maxWithdraw;
        _vaultParameters.targetReservesLevel = vaultParams.targetReservesLevel;
        _vaultParameters.managementFeeRate = vaultParams.managementFeeRate;
        _vaultParameters.firstDeposit = vaultParams.firstDeposit;
        _vaultParameters.decimals = vaultParams.decimals;

        _exchangeRateDecimal = 10 ** _vaultParameters.decimals;
        _operatorAddress = operatorAddress;
        _feeTo = feeTo;
        _exchangeRate[_epoch] = 1 * _exchangeRateDecimal; // 1 : 1
        _coinbaseAccount = coinbaseAccount;
        _withdrawalQueue.first = 1;
        _queueCounter = 1;
        _minTxsFee = 25 * (10 ** _vaultParameters.decimals); // 25$
    }

    // add/remove investor whitelist (only admin)
    function whitelistInvestor(address investor, bool status) onlyAdminOrOperator external {
        _isWhitelist[investor] = status;
        emit WhiteListInvestor(investor, status);
    }

    function setTransactionFee(uint256 transactionFee) onlyAdminOrOperator whenPaused external {
        _vaultParameters.transactionFee =  transactionFee;
        emit SetTransactionFee(transactionFee);
    }

    function setTransactionFeeWeekdayRate(uint256 transactionFeeWeekdayRate) onlyAdminOrOperator whenPaused external {
        _vaultParameters.transactionFeeWeekdayRate =  transactionFeeWeekdayRate;
        emit SetTransactionFeeWeekdayRate(transactionFeeWeekdayRate);

    }

    function setTransactionFeeWeekendRate(uint256 transactionFeeWeekendRate) onlyAdminOrOperator whenPaused external {
        _vaultParameters.transactionFeeWeekendRate =  transactionFeeWeekendRate;
        emit SetTransactionFeeWeekendRate(transactionFeeWeekendRate);
    }

    function setFirstDeposit(uint256 firstDeposit) onlyAdminOrOperator whenPaused external {
        _vaultParameters.firstDeposit =  firstDeposit;
        emit SetFirstDeposit(firstDeposit);
    }

    function setMinDeposit(uint256 minDeposit) onlyAdminOrOperator whenPaused external {
        _vaultParameters.minDeposit =  minDeposit;
        emit SetMinDeposit(minDeposit);
    }

    function setMaxDeposit(uint256 maxDeposit) onlyAdminOrOperator whenPaused external {
        _vaultParameters.maxDeposit =  maxDeposit;
        emit SetMaxDeposit(maxDeposit);
    }

    function setMaxWithdraw(uint256 maxWithdraw) onlyAdminOrOperator whenPaused external {
        _vaultParameters.maxWithdraw =  maxWithdraw;
        emit SetMaxWithdraw(maxWithdraw);
    }

    function setTargetReservesLevel(uint256 targetReservesLevel) onlyAdminOrOperator whenPaused external {
        _vaultParameters.targetReservesLevel =  targetReservesLevel;
        emit SetTargetReservesLevel(targetReservesLevel);
    }

    function setManagementFeeRate(uint256 managementFeeRate) onlyAdminOrOperator whenPaused external {
        _vaultParameters.managementFeeRate =  managementFeeRate;
        emit SetManagementFeeRate(managementFeeRate);
    }

    function setDecimals(uint256 decimal) onlyAdminOrOperator whenPaused external {
        _vaultParameters.decimals =  decimal;
        emit SetDecimals(decimal);
    }

    function updateExchangeRateDecimal() onlyAdminOrOperator external {
        _exchangeRateDecimal = 10 ** _vaultParameters.decimals;
        emit UpdateExchangeRateDecimal(_exchangeRateDecimal);
    }

    // set address reveive service fee (only admin)
    function setFeeTo(address feeTo) /*onlyOwner*/ onlyAdminOrOperator external {
        _feeTo = feeTo;
        emit SetFeeTo(feeTo);
    }

    // set address reveive service fee (only admin)
    function setCoinbaseAccount(address newAddress) onlyOwner external {
        require(newAddress != address(0), "Invalid address");
        _coinbaseAccount = newAddress;
        emit UpdateCoinbaseAccount(newAddress);
    }

    // Set operator address
    function setOperator(address operatorAddress) external /*onlyOwner*/ onlyAdminOrOperator {
        require(operatorAddress != address(0), "Cannot be zero address");
        _operatorAddress = operatorAddress;
        emit NewOperatorAddress(operatorAddress);
    }

    modifier onlyWhitelist(address investor) {
        require(_isWhitelist[investor], "only investor in whitelist");
        _;
    }

    modifier onlyCaller(address receiver) {
        require(_msgSender() == receiver, "receiver must be caller");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == _operatorAddress, "Not operator");
        _;
    }

    modifier onlyAdminOrOperator() {
        require(msg.sender == owner() || msg.sender == _operatorAddress, "Not operator/admin");
        _;
    }

    function checkWhitelist(address investor) view external returns(bool){
        return _isWhitelist[investor];
    }

    /** @dev See {IERC4626-deposit}. */
    function deposit(uint256 assets, address receiver) 
        public virtual override
        onlyWhitelist(_msgSender())
        onlyCaller(receiver)
        nonReentrant
        whenNotPaused
    returns (uint256) {
        // validate for min/max deposit on a day
        _validateDeposit(assets);
        bytes32 requestId = _requestTotalOffchainAssets(assets, Action.Deposit);
        emit RequestDeposit(receiver, assets, requestId);
        return 1;
    }

    /** @dev See {IERC4626-mint}. */
    function mint(uint256 shares, address receiver) public virtual override returns (uint256) {
        return 0;
    }

    /** @dev See {IERC4626-withdraw}. */
    function withdraw(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override
        onlyWhitelist(_msgSender())
        onlyCaller(receiver) 
        onlyCaller(owner)
        nonReentrant
        whenNotPaused
    returns (uint256) {
        // validate for min/max withdraw on a day
        _validateWithdraw(receiver, shares);
        bytes32 requestId = _requestTotalOffchainAssets(shares, Action.Withdraw);
        emit RequestWithdraw(receiver, shares, requestId);
        return 1;
    }

    /** @dev See {IERC4626-redeem}. */
    function redeem(uint256 shares, address receiver, address owner) public virtual override returns (uint256) {
        return 0;
    }

    function requestUpdateEpoch() external /* whenPaused */ onlyAdminOrOperator {
        bytes32 requestId = _requestTotalOffchainAssets(0, Action.EpochUpdate);
        emit RequestUpdateEpoch(msg.sender, requestId);
    }

    function processWithdrawalQueue() external onlyAdminOrOperator {
        bytes32 requestId = _requestTotalOffchainAssets(0, Action.WithdrawalQueue);
        emit RequestWithdrawalQueue(msg.sender, requestId);
    }

    function txsFee(uint256 assets) public view returns (uint256) {
        uint256 bpsTxsFee = (assets * _vaultParameters.transactionFee) / bpsUnit;
        return bpsTxsFee < _minTxsFee ? _minTxsFee : bpsTxsFee;
    }

    // fundTBillPurchase
    function fundTBillPurchase(uint256 assets) /*onlyOwner*/ onlyAdminOrOperator external {
        // transfer usdc from vault to coinbase account
        require(assets <= _asset.balanceOf(address(this)), "fundTBillPurchase: insufficient amount");
        SafeERC20.safeTransfer(_asset, _coinbaseAccount, assets);
        emit FundTBillPurchase(_coinbaseAccount, assets);
    }

    /**
     * @dev Internal conversion function (from shares to assets) with support for rounding direction.
     */
    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal override view virtual returns (uint256 assets) {
        return (shares * _exchangeRate[_epoch] * bpsUnit ) / ( bpsUnit - _vaultParameters.transactionFee ) / _exchangeRateDecimal;
    }

    function _convertToAssets(uint256 shares, uint256 exchangeRate) internal view virtual returns (uint256 assets) {
        return (shares * exchangeRate * bpsUnit ) / ( bpsUnit - _vaultParameters.transactionFee ) / _exchangeRateDecimal;
    }

    function _convertToShares(uint256 assets, uint256 exchangeRate) internal view virtual returns (uint256 shares) {
        uint256 netAssets = assets - txsFee(assets);
        return (netAssets * _exchangeRateDecimal / exchangeRate);
    }

    function _validateDeposit(uint256 assets) internal view virtual {
        require(assets <= _asset.balanceOf(msg.sender), "_validateDeposit: deposit more than max balance");
        require(assets >= _vaultParameters.minDeposit, "_validateDeposit: deposit less than minimum Deposit");
        if(_firstDeposit[msg.sender] == false) {
            require(assets >= _vaultParameters.firstDeposit, "_validateDeposit: deposit less than minimum first Deposit");
        }
        if(_depositAmount[msg.sender][_epoch] >= _withdrawAmount[msg.sender][_epoch]) {
            require(
                assets <= _vaultParameters.maxDeposit - (_depositAmount[msg.sender][_epoch] - _withdrawAmount[msg.sender][_epoch]),
                "_validateDeposit: deposit more than max(depositAmount more than withdrawAmount)"
            );
        } else {
            require(
                assets <= _vaultParameters.maxDeposit + (_withdrawAmount[msg.sender][_epoch] - _depositAmount[msg.sender][_epoch]),
                "_validateDeposit: deposit more than max(depositAmount less than withdrawAmount)"
            );
        }
    }

    function _requestTotalOffchainAssets(uint256 amount, Action action) internal returns(bytes32 requestId) {
        require(
            action == Action.Deposit || action == Action.Withdraw
            || action == Action.WithdrawalQueue || action == Action.EpochUpdate,
            "invalid action"
        );
        Chainlink.Request memory req = buildChainlinkRequest(
            _chainLinkParameters.jobId,
            address(this),
            this.fulfill.selector
        );
        // Set the URL to perform the GET request on
        req.add(
            "get",
            _chainLinkParameters.urlData // offchain assets url
        );
        if( action == Action.EpochUpdate)
            req.add("path", _chainLinkParameters.pathToTotalOffchainAssetAtLastClose);
        else {
            req.add("path", _chainLinkParameters.pathToOffchainAssets);
        }
        // Multiply the result by decimals
        int256 timesAmount = int256(10 ** _vaultParameters.decimals);
        req.addInt("times", timesAmount);
        RequestData memory requestData = RequestData(msg.sender, amount, action);
        requestId = sendChainlinkRequest(req, _chainLinkParameters.fee);
        _requestIdToRequestData[requestId] = requestData;
    }

    function fulfill(
        bytes32 requestId,
        uint256 totalOffChainAssets
    ) public recordChainlinkFulfillment(requestId) {
        // calculate exchange rate
        uint256 exchangeRate;
        if(totalSupply() == 0) {
            exchangeRate = 1 * _exchangeRateDecimal; // exchange rate 1:1
        } else {
            exchangeRate = previewExchangeRate(totalOffChainAssets);
        }
        Action action = _requestIdToRequestData[requestId].action;
        address investor = _requestIdToRequestData[requestId].investor;

        if(action == Action.Deposit) {
            uint256 assets = _requestIdToRequestData[requestId].amount;
            _processDeposit(investor, assets, exchangeRate, requestId);
        } else if(action == Action.Withdraw) {
            uint256 shares = _requestIdToRequestData[requestId].amount;
            _processWithdraw(investor, shares, exchangeRate, requestId);
        } else if (action == Action.WithdrawalQueue) {
            _processWithdrawalQueue(exchangeRate, requestId);
        } else if (action == Action.EpochUpdate) {
            _updateEpochData(totalOffChainAssets, requestId);
        }
        emit Fulfill(investor, requestId, totalOffChainAssets, exchangeRate, _requestIdToRequestData[requestId].amount, action);
    }
    
    function _processDeposit(address investor, uint256 assets, uint256 exchangeRate, bytes32 requestId) internal {
        require(assets <= _asset.balanceOf(investor), "TBILL: Insuficient amount");
        // update amount deposit for each user
        _depositAmount[investor][_epoch] += assets;
        // calculate amount shares to minting
        uint256 shares = _convertToShares(assets, exchangeRate);
        // mint shares to inverstor and transfer net usdc(assets - txsFee(assets) to vault
        _deposit(investor, investor, assets - txsFee(assets), shares);
        // trasfer txs fee to fee receiver
        SafeERC20.safeTransferFrom(_asset, investor, _feeTo, txsFee(assets));
        if(_firstDeposit[investor] == false) {
           _firstDeposit[investor] = true; 
        }
        emit ProcessDeposit(investor, assets, shares, exchangeRate, requestId, txsFee(assets), _feeTo);
    }

    function _processWithdraw(address investor, uint256 shares, uint256 exchangeRate, bytes32 requestId) internal {
        require(shares <= balanceOf(investor), "TBILL: Insuficient amount");
        uint256 assets = previewRedeem(shares, exchangeRate);

        uint256 currentFreeAssets = 0;
        uint256 subShare = 0;
        if(assets <= totalAssets()) {
            _withdraw(investor, investor, investor, assets, shares);
        } else {
            if(totalAssets() > 0) {
                currentFreeAssets = totalAssets();
                subShare = previewWithdraw(currentFreeAssets, exchangeRate);
                _withdraw(investor, investor, investor, currentFreeAssets, subShare);
            }
            _updateQueueWithdrawal(investor, shares - subShare, requestId);
        }
        _withdrawAmount[investor][_epoch] += assets;
        emit ProcessWithdraw(investor, assets, shares, exchangeRate, requestId, currentFreeAssets, subShare);
    }

    function _validateWithdraw(address receiver, uint256 share) internal view virtual {
        require(share <= balanceOf(receiver), "TBILL: withdraw more than max");
        require(share > 0, "TBILL: withdraw invalid amount");
        
        uint256 assets = share * _exchangeRate[_epoch] / _exchangeRateDecimal;
        if(_depositAmount[msg.sender][_epoch] >= _withdrawAmount[msg.sender][_epoch]) {
            require(
                assets <= _vaultParameters.maxWithdraw + (_depositAmount[msg.sender][_epoch] - _withdrawAmount[msg.sender][_epoch]),
                "TBILL: withdraw more than max"
            );
        } else {
            require(
                assets <= _vaultParameters.maxWithdraw - (_withdrawAmount[msg.sender][_epoch] - _depositAmount[msg.sender][_epoch]),
                "TBILL: withdraw more than max"
            );
        }
    }

    function _pushQueue(WithdrawalInfo memory data) internal virtual {
        _withdrawalQueue.last += 1;
        _withdrawalQueue.items[_withdrawalQueue.last] = data;
    }

    function _popQueue() internal virtual returns(WithdrawalInfo memory data) {
        require(_withdrawalQueue.last >= _withdrawalQueue.first);  // non-empty queue
        
        data = _withdrawalQueue.items[_withdrawalQueue.first];

        delete _withdrawalQueue.items[_withdrawalQueue.first];
        _withdrawalQueue.first += 1;
    }

    function _emptyQueue() internal virtual returns(bool) {
        return _withdrawalQueue.last < _withdrawalQueue.first;
    }

    function getWithdrawalQueueInfo(uint256 item) external view returns(WithdrawalInfo memory)  {
        return _withdrawalQueue.items[item];
    }

    function getWithdrawalQueueLength() external view returns(uint256) {
        return _withdrawalQueue.last - _withdrawalQueue.first;
    }

    function setMinTxsFee(uint256 newValue) external onlyAdminOrOperator {
        _minTxsFee = newValue;
        emit UpdateMinTxsFee(newValue);
    }

    // whenNotPaused
    function setChainlinkTokenAddress(address newAddress) external onlyAdminOrOperator whenNotPaused  {
        require(newAddress != address(0), "invalid address");
        setChainlinkToken(newAddress);
        emit SetChainlinkTokenAddress(newAddress);
    }

    // whenNotPaused
    function setChainlinkOracleAddress(address newAddress) external onlyAdminOrOperator whenNotPaused {
        require(newAddress != address(0), "invalid address");
        setChainlinkOracle(newAddress);
        emit SetChainlinkOracleAddress(newAddress);
    }

    function setChainlinkFee(uint256 fee) external onlyAdminOrOperator /* whenPaused */ {
        _chainLinkParameters.fee = fee;
        emit SetChainlinkFee(fee);
    }

    function setChainlinkJobId(bytes32 jobId) external onlyAdminOrOperator /* whenPaused */ {
        _chainLinkParameters.jobId = jobId;
        emit SetChainlinkJobId(jobId);

    }

    function setChainlinkURLData(string memory url) external onlyAdminOrOperator /* whenPaused */ {
        _chainLinkParameters.urlData = url;
        emit SetChainlinkURLData(url);
    }

    function setPathToOffchainAssets(string memory path) external onlyAdminOrOperator /* whenPaused */ {
        _chainLinkParameters.pathToOffchainAssets = path;
        emit SetPathToOffchainAssets(path);
    }

    function setPathToTotalOffchainAssetAtLastClose(string memory path) external onlyAdminOrOperator /* whenPaused */ {
        _chainLinkParameters.pathToTotalOffchainAssetAtLastClose = path;
        emit SetPathToTotalOffchainAssetAtLastClose(path);
    }

    function _updateQueueWithdrawal(address investor, uint256 shares, bytes32 requestId) internal virtual  {
        uint256 index = _queueCounter;
        _queueCounter++;
        WithdrawalInfo memory withdrawalInfo = WithdrawalInfo(investor, shares, index);
        // push withdrawal info to queue
        _pushQueue(withdrawalInfo);
        // transfer share to vault for lock
        _transfer(investor, address(this), shares);
        // emit event
        emit UpdateQueueWithdrawal(investor, shares, index, requestId);
    }

    function _updateEpoch() internal virtual {
        _epochCounter.increment();
        _epoch = _epochCounter.current();
    }

    function _validWithdrawal( uint256 share, uint256 exchangeRate) internal view returns (bool) {
       uint256 assets = previewRedeem(share, exchangeRate);
       return assets <= totalAssets();
    }

    function _processWithdrawalQueue(uint256 exchangeRate, bytes32 requestId) internal
    {
        require(!_emptyQueue(), "Withdrawal Queue is Empty!");

        while(_validWithdrawal(_withdrawalQueue.items[_withdrawalQueue.first].shares, exchangeRate) && !_emptyQueue()) {
            //exchangeRate = previewExchangeRate(totalOffchainAssets); 
            WithdrawalInfo memory data = _popQueue();
            // burn tbill
            _burn(address(this), data.shares);
            uint256 assets = previewRedeem(data.shares, exchangeRate);
            // transfer usdc to invertor
            SafeERC20.safeTransfer(_asset, data.investor, assets);
            // emit event
            emit ProcessWithdrawalQueue(data.investor, assets, data.shares, exchangeRate, data.index, requestId);
        }
    }

    function previewWithdraw(uint256 assets, uint256 exchangeRate) public view virtual returns (uint256) {
        return (assets * _exchangeRateDecimal) / exchangeRate;
    }

    function previewRedeem(uint256 shares, uint256 exchangeRate) public view virtual returns (uint256) {
        return (shares * exchangeRate) / _exchangeRateDecimal;
    }

    function previewExchangeRate(uint256 totalOffchainAssets) public view virtual returns (uint256) {
        return (totalOffchainAssets + totalAssets() - _feeClaimable) * _exchangeRateDecimal / totalSupply(); 
    }

    // update batch trade execution
    function _updateEpochData(uint256 totalOffchainAssetAtLastClose, bytes32 requestId) internal {
        _updateEpoch();
        // update total IBKR Assets(USD)
        _totalOffchainAssets[_epoch] = totalOffchainAssetAtLastClose;
        // calculate total usd assets(onchain usdc + off-chain IBKR(USD))
        _totalOEAssets[_epoch] = totalAssets() + totalOffchainAssetAtLastClose; 
        // update daily management fee: dailyManagementFee = TVL * (managementFeeRate/365)
        _dailyManagementFee[_epoch] = (_totalOEAssets[_epoch] *  _vaultParameters.managementFeeRate) / (365 * bpsUnit);
       
       // update transactionFee base on weekday
        _vaultParameters.transactionFee = isWeekday() 
        ? _vaultParameters.transactionFeeWeekdayRate
        : _vaultParameters.transactionFeeWeekendRate;

        // update fee claimable
        _feeClaimable += _dailyManagementFee[_epoch];
       
        // update exchange rate: (Total Assets - Management Fee Claimable) / Total Share Tokens
        _exchangeRate[_epoch] = previewExchangeRate(totalOffchainAssetAtLastClose); 
        
        // emit event
        emit UpdateEpochData(
            _totalOEAssets[_epoch],
            _dailyManagementFee[_epoch],
            _totalOffchainAssets[_epoch],
            _vaultParameters.transactionFee,
            _feeClaimable,
            _exchangeRate[_epoch],
            _epoch,
            requestId
        );
    }

    function claimManagementFee(address receiver, uint256 amount) external /*onlyOwner*/ onlyAdminOrOperator {
        require(amount <= _feeClaimable && amount <= _asset.balanceOf(address(this)), "claimManagementFee: insuficient amount");
        _feeClaimable -= amount;
        SafeERC20.safeTransfer(_asset, receiver, amount);
        emit ClaimManagementFee(receiver, amount);
    }
 
    // pause trading on cut-off time
    function pause() external whenNotPaused onlyAdminOrOperator {
        _pause();
        emit Pause(_msgSender());
    }

    // unpause after cut-off time
    function unpause() external whenPaused onlyAdminOrOperator {
        _unpause();
        emit Unpause(_msgSender());
    }

    function isWeekday() public view returns (bool) {
        // Calculate the number of days since the Unix epoch.
        uint256 _days = uint256(block.timestamp / 86400);
        uint256 dayOfWeek = ((_days + 3) % 7) + 1;
        // Return true if the day of the week is between Monday and Friday (inclusive).
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    }

    function decimals() public view virtual override returns (uint8) {
        return uint8(_vaultParameters.decimals);
    }

}