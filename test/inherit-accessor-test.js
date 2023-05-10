const {
  time,
  loadFixture
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { isDebuggerStatement, validateLocaleAndSetLanguage } = require("typescript");
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { numToBytes32 } = require("../helper-functions")
const { BigNumber } = require("ethers");
const { describe } = require("mocha");
const { createBigNumber18, createBigNumber6, ZERO_ADDRESS } = require("../helpers/constants");


describe("Chainlink Oracle", function () {
  let apiConsumer;
  let mockOracle;
  let operator, treasuryAccount, oplServiceProvider, owner, investor1, investor2, investor3, usInvestor, investor5;
  let usdc, vault, baseVault, kycManager, linkToken;
  // const initBalanceInvestor = BigNumber.from('100000000000000'); // 10M
  const initBalanceInvestor = createBigNumber6(10000000) // 10M
  const _200k = BigNumber.from("200000000000");
  const _100k = BigNumber.from("100000000000");
  const _900k = BigNumber.from("900000000000");
  const _1M = BigNumber.from("1000000000000");
  const _1M100k = BigNumber.from("1100000000000");
  const _99k950 = BigNumber.from("99950000000");
  const _99k951 = BigNumber.from("99950000001");
  const _50k = BigNumber.from("50000000000");
  const _5k = BigNumber.from("5000000000");
  const _70k = BigNumber.from("70000000000");
  const _30k = BigNumber.from("30000000000");
  const _10k = BigNumber.from("10000000000");
  const _1B = BigNumber.from("1000000000000000");
  const _25$ = BigNumber.from("25000000");
  const _50$ = BigNumber.from("50000000");
  const _100$ = BigNumber.from("100000000");


  const minDepositAmount = _10k;
  const minDeposit = _10k;
  const maxDeposit = _1M;
  const maxWithdraw = _1M;
  const firstDepositAmount = _100k;

  const transactionFee = 5; // 5bps
  const targetReservesLevel = 10; // 10%
  const onchainServiceFeeRate = 40; // 40bps
  const offchainServiceFeeRate = 40; // 40bps
  const minTxsFee = _25$// 25$

  const BPSUNIT = 10000;

  beforeEach(async function () {
    [owner, investor1, investor2, investor3, usInvestor, investor5, operator, treasuryAccount, oplServiceProvider] = await ethers.getSigners();
    const USDC = await ethers.getContractFactory("USDC");
    usdc = await USDC.deploy();
    await usdc.deployed();

    const linkTokenFactory = await ethers.getContractFactory("LinkToken")
    linkToken = await linkTokenFactory.deploy()
    await linkToken.deployed();

    const mockOracleFactory = await ethers.getContractFactory("MockOracle")
    mockOracle = await mockOracleFactory.deploy(linkToken.address)
    await mockOracle.deployed();

    const chainlinkJobId = ethers.utils.toUtf8Bytes("29fa9aa13bf1468788b7cc4a500a1234")
    const chainlinkFee = "100000000000000000"
    const fundAmount = "10000000000000000000"

    // deploy base vault contract
    const BaseVault = await ethers.getContractFactory("BaseVault");
    baseVault = await BaseVault.deploy(
      transactionFee, // 5 bps
      firstDepositAmount,
      minDeposit, // 100000 USDC
      maxDeposit, // max deposit on a day
      maxWithdraw, // max withdraw on a day
      targetReservesLevel, // 10%
      onchainServiceFeeRate, // 40 bps
      offchainServiceFeeRate, // 40 bps
    );
    await baseVault.deployed();

    // deploy kycManager
    const KycManager = await ethers.getContractFactory("KycManager");
    kycManager = await KycManager.deploy();
    await kycManager.deployed();

    // prepare chainlink parameters
    const chainlinkParameters = {
      jobId: chainlinkJobId,
      fee: chainlinkFee,
      urlData: "https://openeden-node.vercel.app/vault/assets/offchain",
      pathToOffchainAssets: "totalOffChainAssets",
      pathToTotalOffchainAssetAtLastClose: "pathToTotalOffchainAssetAtLastClose"
    }
    // deploy vault contract
    const Vault = await ethers.getContractFactory("OpenEdenVault");
    vault = await Vault.deploy();
    await vault.deployed();
    await vault.initialize(
      usdc.address,
      operator.address,
      oplServiceProvider.address,
      treasuryAccount.address,
      baseVault.address,
      kycManager.address,
      linkToken.address,
      mockOracle.address,
      chainlinkParameters
    );

    await linkToken.transfer(vault.address, fundAmount)

    // transfer usdc to investor
    await usdc.transfer(investor1.address, initBalanceInvestor);
    await usdc.transfer(investor2.address, initBalanceInvestor);
    await usdc.transfer(investor3.address, initBalanceInvestor);
    await usdc.transfer(usInvestor.address, initBalanceInvestor);
    //await usdc.transfer(investor5.address, initBalanceInvestor);
    await usdc.connect(investor1).approve(vault.address, initBalanceInvestor);
    await usdc.connect(investor2).approve(vault.address, initBalanceInvestor);
    await usdc.connect(investor3).approve(vault.address, initBalanceInvestor);
    await usdc.connect(usInvestor).approve(vault.address, initBalanceInvestor);
    await usdc.connect(investor5).approve(vault.address, initBalanceInvestor);

    // 0: NON KYC, 
    // 1: US KYC
    // 2: GENERAL KYC 
    await kycManager.grantKycInBulk([
      investor1.address,
      investor2.address,
      investor3.address,
      usInvestor.address
    ],
      [2, 2, 2, 1]);

    // fund link
    await linkToken.transfer(vault.address, fundAmount);
  });

  async function deposit(invertor, depositAmount, totalOffChainAssets) {
    const transaction = await vault.connect(invertor).deposit(depositAmount, invertor.address);

    const transactionReceipt = await transaction.wait(1)
    const requestId = transactionReceipt.events[0].topics[1]
    // current off-chain assets
    const callbackValue = BigNumber.from(totalOffChainAssets);
    return await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue));
  }

  async function withdraw(invertor, amount, totalOffChainAssets) {
    const transaction = await vault.connect(invertor).withdraw(amount, invertor.address, invertor.address);
    const transactionReceipt = await transaction.wait(1)
    const requestId = transactionReceipt.events[0].topics[1]
    // current off-chain assets
    const callbackValue = BigNumber.from(totalOffChainAssets);
    await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
  }

  async function requestEpochUpdate(totalOffChainAssets) {
    // pause
    const transaction = await vault.requestUpdateEpoch();
    // unpause
    const transactionReceipt = await transaction.wait(1)
    const requestId = transactionReceipt.events[0].topics[1]
    // current off-chain assets
    const callbackValue = BigNumber.from(totalOffChainAssets);
    await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
  }

  async function processWithdrawalQueue(totalOffChainAssets) {
    const transaction = await vault.processWithdrawalQueue();
    const transactionReceipt = await transaction.wait(1)
    const requestId = transactionReceipt.events[0].topics[1]
    // current off-chain assets
    const callbackValue = BigNumber.from(totalOffChainAssets);
    // await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
    await expect(mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))).
      to.emit(vault, "ProcessWithdrawalQueue")
  }

  describe('basic test by Minh', () => {

    it("update baseVault, kycManager address", async function () {
      await vault.setBaseVault(newAddress)
      await expect(await vault._baseVault()).to.equal(newAddress);
      await vault.setKycManager(newAddress)
      await expect(await vault._kycManager()).to.equal(newAddress);
    });

    it("deposit and withdraw, queue check ", async function () {
      // deposit
      await deposit(investor1, firstDepositAmount, "0");
      console.log('firstDepositAmount:', firstDepositAmount);

      let bal1 = await vault.balanceOf(investor1.address)
      console.log("bal for investor1:", bal1);

      // queue check
      expect(await vault.getWithdrawalQueueLength()).to.equal(0);
      await withdraw(investor1, bal1, firstDepositAmount * 2);
      expect(await vault.getWithdrawalQueueLength()).to.equal(1);
      bal1 = await vault.balanceOf(investor1.address)
      console.log("bal for investor1:", bal1.toString());

      let info = await vault.getWithdrawalQueueInfo(0)
      console.log('info:', info);
      info = await vault.getWithdrawalQueueInfo(1);
      await expect(info.investor).to.equal("0x0000000000000000000000000000000000000000");
      await expect(info.shares).to.equal("0");
    });

    it("withdraws abnormal case", async function () {
      //deposit
      await deposit(usInvestor, _100k, "0");
      // await withdraw(investor1, _99k951, "0");
      await expect(withdraw(usInvestor, _99k951, "0")).to.revertedWith("withdraw more than balance");
      await expect(withdraw(usInvestor, "0", "0")).to.revertedWith("withdraw invalid amount");
      await deposit(usInvestor, _900k, "0");
      await requestEpochUpdate("0");
      await deposit(usInvestor, _900k, "0");
      await requestEpochUpdate("0");
      // withdraw _1M100k
      await expect(withdraw(usInvestor, _1M100k, "0")).to.revertedWith("withdraw too much 1");
      // withdraw _50k
      await withdraw(usInvestor, _50k, "0");
      // withdraw _1M100k
      await expect(withdraw(usInvestor, _1M100k, "0")).to.revertedWith("withdraw too much 2");
    });

    it("deposits abnormal case", async function () {
      //deposit
      await expect(deposit(usInvestor, _50k, '0')).to.revertedWith("amount lt minimum first deposit");
      await deposit(usInvestor, _100k, "0");
      await expect(deposit(usInvestor, _1B)).to.revertedWith("insufficient balance");
      await expect(deposit(usInvestor, _5k)).to.revertedWith("amount lt minimum deposit");
      await expect(deposit(usInvestor, _1M, "0")).to.revertedWith("deposit too much 1");
      await requestEpochUpdate("0");
      await withdraw(usInvestor, _50k, "0");
      await expect(deposit(usInvestor, _1M100k, "0")).to.revertedWith("deposit too much 2");

      //await requestEpochUpdate("0");
    });

    it("must whitelist vault when before us investor withdraw more than available usdc in vault", async function () {
      //deposit
      await deposit(usInvestor, _100k, "0");
      await deposit(investor1, _100k, "0");
      await deposit(investor2, _100k, "0");

      await vault.fundTBillPurchase(usdc.address, _200k);
      await withdraw(investor1, _50k, _200k);
      await withdraw(investor2, _30k, _200k);
      // now vault have only ~20k
      // us investor withdraw 50k
      await withdraw(usInvestor, _50k, _200k);// fulfill revert because, vault is non kyc account and us can't transfer to non kyc
      await expect(await vault.getWithdrawalQueueLength()).to.equal(0);
      await kycManager.grantKycInBulk([vault.address], [2]); // kyc vault
      await withdraw(usInvestor, _50k, _200k);
      await expect(await vault.getWithdrawalQueueLength()).to.equal(1);
    });
    it("txs fee check", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");
      let expectedTxFee = await vault.txsFee(firstDepositAmount);
      let txFee = firstDepositAmount.mul(await baseVault.getTransactionFee()).div(BPSUNIT);
      expect(txFee).to.equal(expectedTxFee);

      // investor2 deposit
      await deposit(investor2, firstDepositAmount, "0");
      expectedTxFee = expectedTxFee.add(await vault.txsFee(firstDepositAmount));
      txFee = txFee.add(firstDepositAmount.mul(await baseVault.getTransactionFee()).div(BPSUNIT));
      expect(txFee).to.equal(expectedTxFee);
    });

    it("deposit, totalSupply, totalAssets, opl account check", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");
      let txFee = await vault.txsFee(firstDepositAmount);
      let expectedBalance = firstDepositAmount.sub(txFee);
      console.log("usdc deposit: " + firstDepositAmount);
      console.log("txFee: " + txFee);
      console.log("t-bill received: " + expectedBalance);

      expect(await vault.balanceOf(investor1.address)).to.equal(expectedBalance);

      await deposit(investor2, firstDepositAmount * 2, "0");
      expect(await vault.balanceOf(investor2.address)).to.equal(expectedBalance * 2);

      // total supply
      console.log("t-bill received investor2: " + await vault.balanceOf(investor2.address));
      expect(await vault.totalAssets()).to.equal(expectedBalance * 3);

      // total assets
      const expectedTotalSupply = expectedBalance * 3;
      expect(await vault.totalSupply()).to.equal(expectedTotalSupply);

      // total usdc in vault
      const expectedUsdcInVault = (firstDepositAmount * 3) - (await vault.txsFee(firstDepositAmount * 3));
      expect(await usdc.balanceOf(vault.address)).to.equal(expectedUsdcInVault);

      // txs fee on oplServiceProvider account
      txFee = await vault.txsFee(firstDepositAmount * 3);
      expect(await usdc.balanceOf(oplServiceProvider.address)).to.equal(txFee);

    });

    it("withdraw, opl account check", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");
      // investor2 deposit
      await deposit(investor2, firstDepositAmount * 3, "0");
      const tbillInvestor1 = await vault.balanceOf(investor1.address);
      // investor1 withdraw
      await withdraw(investor1, tbillInvestor1, "0");
      expect(await vault.balanceOf(investor1.address)).to.equal(0);
      // investor2 withdraw
      const tbillInvestor2 = await vault.balanceOf(investor2.address);
      await withdraw(investor2, tbillInvestor2, "0");
      expect(await vault.balanceOf(investor2.address)).to.equal(0);
      // check usdc balance of opl account
      const txFee = await vault.txsFee(firstDepositAmount * 4);
      expect(await usdc.balanceOf(oplServiceProvider.address)).to.equal(txFee);
    });

    it("deposit, queue length", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");
      // investor2 deposit2
      await deposit(investor2, firstDepositAmount, "0");
      console.log("balance investor1: ", await vault.balanceOf(investor1.address));
      console.log("balance investor2: ", await vault.balanceOf(investor2.address));
      expect(await vault._onchainFee()).to.equal(0);
      expect(await vault._offchainFee()).to.equal(0);

      expect(await vault._epoch()).to.equal(0);
      let latestOffchainAssets = firstDepositAmount;

      // onchain fee claimable
      let totalOnchainAssets = await vault.totalAssets();
      console.log("totalAssetsAvailable: " + totalOnchainAssets);

      await requestEpochUpdate(latestOffchainAssets);
      expect(await vault._epoch()).to.equal(1);
      await deposit(investor3, firstDepositAmount, firstDepositAmount);
      console.log("balance investor3: ", await vault.balanceOf(investor3.address));

      // onchain/offchain service fee ===
      const [onchainFee, offchainFee] = await baseVault.getOnchainAndOffChainServiceFeeRate();
      expect(onchainFee).to.equal(onchainServiceFeeRate);
      expect(offchainFee).to.equal(offchainServiceFeeRate);
      // ====

      // onchain fee claimable 
      // const onchainFeeClaimable = (totalOnchainAssets * onchainFee) / (356 * BPSUNIT)
      // expect(onchainFeeClaimable).to.equal(Number(await vault._onchainServiceFeeClaimable()));
    });

    it("deposit, epoch counter, queue length, fundTBillPurchase, treasury account check", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");
      // investor2 deposit2
      await deposit(investor2, firstDepositAmount, "0");
      const actualAsset = firstDepositAmount - (await vault.txsFee(firstDepositAmount));
      let estimateAmount = await vault.previewDeposit(firstDepositAmount);
      console.log("estimateAmount1: ", estimateAmount);

      await vault.fundTBillPurchase(usdc.address, actualAsset);
      expect(await usdc.balanceOf(treasuryAccount.address)).to.equal(actualAsset);
      await requestEpochUpdate(actualAsset);
      estimateAmount = await vault.previewDeposit(firstDepositAmount);
      console.log("estimateAmount2: ", estimateAmount);
      await requestEpochUpdate(actualAsset);
      estimateAmount = await vault.previewDeposit(firstDepositAmount);
      console.log("estimateAmount3: ", estimateAmount);
      expect(await vault._epoch()).to.equal(2);
    });

    // ====== KYC MANAGER ======
    it("not a kyc user can transfer tbill to other account", async function () {
      const amountTbillTransfer = "10000000000"; // 10k
      await deposit(investor1, firstDepositAmount, "0");
      await kycManager.revokeKycInBulk([investor1.address]);
      await expect(vault.connect(investor1).deposit(firstDepositAmount, investor1.address)).to.revertedWith("not a kyc user");
      await expect(vault.connect(investor5).deposit(firstDepositAmount, investor5.address)).to.revertedWith("not a kyc user");
      await vault.connect(investor1).transfer(investor2.address, amountTbillTransfer);
    });

    it("revoke kyc than grantKycInBulk", async function () {
      await kycManager.revokeKycInBulk([investor1.address]);
      await kycManager.grantKycInBulk([investor1.address], [1]);
      await deposit(investor1, firstDepositAmount, "0");
    });

    it("us kyc deposit, and transfer to non kyc", async function () {
      await deposit(usInvestor, firstDepositAmount, "0");
      const amountTbillTransfer = "10000000000"; // 10k
      await vault.connect(usInvestor).transfer(investor1.address, amountTbillTransfer);
      await expect(vault.connect(usInvestor).transfer(investor5.address, amountTbillTransfer)).to.revertedWith("not a kyc user");
    });

    it("generis kyc deposit, and transfer to non kyc", async function () {
      await deposit(investor1, firstDepositAmount, "0");
      const amountTbillTransfer = "10000000000"; // 10k
      await vault.connect(investor1).transfer(investor5.address, amountTbillTransfer);
    });

    it("banded investor can't transfer or receive tbill", async function () {
      await deposit(investor1, firstDepositAmount, "0");
      await deposit(investor2, firstDepositAmount, "0");
      await kycManager.bannedInBulk([investor1.address]);
      await expect(await kycManager.isBanned(investor1.address)).to.equal(true);
      const amountTbillTransfer = "10000000000"; // 10k
      await expect(vault.connect(investor1).transfer(investor2.address, amountTbillTransfer)).to.revertedWith("user is banned");
      await expect(vault.connect(investor2).transfer(investor1.address, amountTbillTransfer)).to.revertedWith("user is banned");
      await kycManager.unBannedInBulk([investor1.address]);
      await expect(await kycManager.isBanned(investor1.address)).to.equal(false);
      await vault.connect(investor1).transfer(investor2.address, amountTbillTransfer);
      await vault.connect(investor2).transfer(investor1.address, amountTbillTransfer);
      await deposit(investor1, firstDepositAmount, "0");
    });

    it("in strict role can't transfer to non kyc user", async function () {
      const amountTbillTransfer = "10000000000"; // 10k
      await deposit(investor1, firstDepositAmount, "0");
      await kycManager.setStrict(true);
      // transfer to kyc
      await vault.connect(investor1).transfer(investor2.address, amountTbillTransfer);
      // can't transfer to non kyc
      await expect(vault.connect(investor1).transfer(investor5.address, amountTbillTransfer)).to.revertedWith("not a kyc user");
      await kycManager.setStrict(false);
      // can transfer to non kyc
      await vault.connect(investor1).transfer(investor5.address, amountTbillTransfer);
      const userInfo = await kycManager.getUserInfo(investor1.address);
      //console.log(userInfo);
      await expect(userInfo.kycType).to.equal(2);
      await expect(userInfo.isBanned).to.equal(false);
    });

    it("kyc check", async function () {
      await expect(await kycManager.isKyc(investor5.address)).to.equal(false);
      await expect(await kycManager.isKyc(investor1.address)).to.equal(true);
      await expect(await kycManager.isKyc(usInvestor.address)).to.equal(true);
      await expect(await kycManager.isNonUSKyc(investor1.address)).to.equal(true);
      await expect(await kycManager.isNonUSKyc(usInvestor.address)).to.equal(false);
    });

    it("kyc role setter", async function () {
      await expect(kycManager.connect(investor1).grantKycInBulk([investor5.address], [1])).to.revertedWith("Ownable: caller is not the owner");
      await expect(kycManager.connect(investor1).revokeKycInBulk([investor2.address])).to.revertedWith("Ownable: caller is not the owner");
      await expect(kycManager.connect(investor1).bannedInBulk([investor2.address])).to.revertedWith("Ownable: caller is not the owner");
      await expect(kycManager.connect(investor2).unBannedInBulk([investor3.address])).to.revertedWith("Ownable: caller is not the owner");
      await expect(kycManager.connect(investor2).setStrict(false)).to.revertedWith("Ownable: caller is not the owner");
      await expect(kycManager.grantKycInBulk([investor5.address], [0])).to.revertedWith("invalid kyc type");
      await expect(kycManager.grantKycInBulk([investor1.address, investor1.address], [1])).to.revertedWith("invalid input");
      await expect(kycManager.grantKycInBulk([ZERO_ADDRESS], [1])).to.revertedWith("invalid address");
      await expect(kycManager.revokeKycInBulk([ZERO_ADDRESS])).to.revertedWith("invalid address");
      await expect(kycManager.bannedInBulk([ZERO_ADDRESS])).to.revertedWith("invalid address");
    });
    // ====== CHAINLINK SETTING ======
    const newAddress = "0x1111111111111111111111111111111111111111";
    const newChainlinkFee = 1;
    const newChainkinkJobId = ethers.utils.toUtf8Bytes("29fa9aa13bf1468788b7cc4a50000000")
    const newChainlinkUrl = "chainlinkUrl";
    const newChainlinkPathToAsset = "pathFoAsset";
    const newChainlinkPathEpoch = "pathForEpochUpdate";
    it("chainlink role setter", async function () {
      await expect(vault.connect(investor1).setChainlinkOracleAddress(newAddress)).to.revertedWith(onlyOwnerMessage);
      await expect(vault.connect(investor1).setChainlinkFee(newChainlinkFee)).to.revertedWith(onlyOwnerMessage);
      await expect(vault.connect(investor1).setChainlinkJobId(newChainkinkJobId)).to.revertedWith(onlyOwnerMessage);
      await expect(vault.connect(investor1).setChainlinkURLData(newChainlinkUrl)).to.revertedWith(onlyOwnerMessage);
      await expect(vault.connect(investor1).setPathToOffchainAssets(newChainlinkPathToAsset)).to.revertedWith(onlyOwnerMessage);
      await expect(vault.connect(investor1).setPathToTotalOffchainAssetAtLastClose(newChainlinkPathEpoch)).to.revertedWith(onlyOwnerMessage);
    });

    it("chainlink role setter for operator account", async function () {
      await vault.connect(owner).setChainlinkOracleAddress(newAddress);
      await vault.connect(owner).setChainlinkFee(newChainlinkFee);
      await vault.connect(owner).setChainlinkJobId(newChainkinkJobId);
      await vault.connect(owner).setChainlinkURLData(newChainlinkUrl);
      await vault.connect(owner).setPathToOffchainAssets(newChainlinkPathToAsset);
      await vault.connect(owner).setPathToTotalOffchainAssetAtLastClose(newChainlinkPathEpoch);

      result = await vault.getChainLinkParameters();
      console.log(result);
      await expect(result.fee).to.equal(newChainlinkFee);
      await expect(result.urlData).to.equal(newChainlinkUrl);
      await expect(result.pathToOffchainAssets).to.equal(newChainlinkPathToAsset);
      await expect(result.pathToTotalOffchainAssetAtLastClose).to.equal(newChainlinkPathEpoch);
    });

    it("chainlink role setter for admin account", async function () {
      await vault.setChainlinkOracleAddress(newAddress);
      await vault.setChainlinkFee(newChainlinkFee);
      await vault.setChainlinkJobId(newChainkinkJobId);
      await vault.setChainlinkURLData(newChainlinkUrl);
      await vault.setPathToOffchainAssets(newChainlinkPathToAsset);
      await vault.setPathToTotalOffchainAssetAtLastClose(newChainlinkPathEpoch);

      result = await vault.getChainLinkParameters();
      console.log(result);
      await expect(result.fee).to.equal(newChainlinkFee);
      await expect(result.urlData).to.equal(newChainlinkUrl);
      await expect(result.pathToOffchainAssets).to.equal(newChainlinkPathToAsset);
      await expect(result.pathToTotalOffchainAssetAtLastClose).to.equal(newChainlinkPathEpoch);
    });
    // ====== OPENEDEN VAULT SETTING ======
    let onlyOwnerMessage = `AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`;
    it("pause/unpause operator", async function () {
      await deposit(investor1, firstDepositAmount, "0");
      await expect(vault.connect(investor1).pause()).to.revertedWith("permission denied");
      await vault.connect(operator).pause();
      await expect(vault.connect(investor1).deposit(firstDepositAmount, investor1.address)).to.revertedWith("Pausable: paused");
      await expect(vault.connect(investor1).withdraw(_50k, investor1.address, investor1.address)).to.revertedWith("Pausable: paused");
      await expect(vault.connect(investor1).unpause()).to.revertedWith("permission denied");
      await vault.connect(operator).unpause();
      await deposit(investor1, firstDepositAmount, "0");
      await withdraw(investor1, _50k, "0");
    });

    it("only admin role", async function (
    ) {
      await expect(vault.connect(investor1).setTreasury(investor1.address)).to.revertedWith(onlyOwnerMessage);
      await expect(vault.connect(investor1).setOplServiceProvider(investor1.address)).to.revertedWith(onlyOwnerMessage);
      await expect(vault.connect(investor1).claimOnchainServiceFee(await vault._onchainFee())).to.revertedWith("permission denied");
      await expect(vault.connect(investor1).claimOffchainServiceFee(await vault._offchainFee())).to.revertedWith("permission denied");
    });

    it("only caller", async function () {
      await deposit(investor1, firstDepositAmount, "0");
      await expect(vault.connect(investor1).deposit(firstDepositAmount, investor2.address)).to.revertedWith("receiver must be caller");
      await expect(vault.connect(investor1).withdraw(_50k, investor2.address, investor1.address)).to.revertedWith("receiver must be caller");
      await expect(vault.connect(investor1).withdraw(_50k, investor1.address, investor2.address)).to.revertedWith("receiver must be caller");
    });

    it("test mint/redeem vault", async function () {
      await expect(vault.mint(firstDepositAmount, investor2.address)).to.revertedWithoutReason();
      await expect(vault.redeem(_50k, investor2.address, investor2.address)).to.revertedWithoutReason();
    });

    it("test mint/redeem vault", async function () {
      await expect(vault.mint(firstDepositAmount, investor2.address)).to.revertedWithoutReason();
      await expect(vault.redeem(_50k, investor2.address, investor2.address)).to.revertedWithoutReason();
    });

    it("mint txsFee", async function () {
      let txsFee = await vault.txsFee(firstDepositAmount);
      const expectedTxsFee = (firstDepositAmount * (await baseVault.getTransactionFee())) / BPSUNIT;
      await expect(txsFee).to.equal(expectedTxsFee);
      // min deposit
      //const amount = BigNumber.from("10000000000"); 
      txsFee = await vault.txsFee(minDepositAmount); //10k
      await expect(txsFee).to.equal(minTxsFee);

      // set new minTxsFee
      const newMinTxsFee = BigNumber.from("30000000"); //30$
      await expect(vault.connect(investor1).setMinTxsFee(newMinTxsFee)).to.rejectedWith("");
      await vault.setMinTxsFee(newMinTxsFee);
      txsFee = await vault.txsFee(minDepositAmount);
      await expect(txsFee).to.equal(newMinTxsFee);
    });

    it("checking getWithdrawalQueueInfo, process withdrawal queue", async function () {
      const _200k = BigNumber.from("200000000000");
      // preview deposit
      let previewDeposit = await vault.previewDepositCustomize(_200k, 0);
      await expect(previewDeposit).to.equal(_200k);
      previewDeposit = await vault.previewDepositCustomize(0, 0);
      await expect(previewDeposit).to.equal(0);

      let previewRedeem = await vault.previewRedeemCustomize(_200k, 0);
      await expect(previewRedeem).to.equal(_200k);
      previewRedeem = await vault.previewRedeemCustomize(0, 0);
      await expect(previewRedeem).to.equal(0);

    });

    it("checking getWithdrawalQueueInfo, process withdrawal queue", async function () {
      let result = await vault.getWithdrawalQueueInfo(0);

      await expect(result.investor).to.equal("0x0000000000000000000000000000000000000000");
      await expect(result.shares).to.equal("0");
      // deposit 300k
      await deposit(investor1, firstDepositAmount, "0");  // 100k
      await deposit(investor2, firstDepositAmount, "0");  // 100k
      await deposit(investor3, firstDepositAmount, "0");  // 100k
      const txsFee = await vault.txsFee(firstDepositAmount * 3);
      const offchainAmount = Number(_200k) + Number(txsFee);

      // fundTBillPurchase 200k
      await vault.fundTBillPurchase(usdc.address, _200k);

      await withdraw(investor1, _50k, offchainAmount);
      await withdraw(investor2, _70k, offchainAmount); // 20k in queue
      await withdraw(investor3, _30k, offchainAmount); // 30k in queue
      let queueLength = await vault.getWithdrawalQueueLength();
      await expect(queueLength).to.equal(2);
      await deposit(investor1, _30k, offchainAmount);  // deposit vault 30k
      await processWithdrawalQueue(offchainAmount)// admin process Withdrawal Queue
      // check queue length again, clear 1 item
      queueLength = await vault.getWithdrawalQueueLength();
      expect(queueLength).to.equal(1);
      result = await vault.getWithdrawalQueueInfo(0);
      expect(result.investor).to.equal(investor3.address);
      expect(result.shares).to.equal(_30k);
    });

    it("check treasury and opl account", async function () {
      // deposit 300k

      await vault.setOplServiceProvider(usInvestor.address);
      const balanceusInvestor = await usdc.balanceOf(usInvestor.address);
      await deposit(investor1, firstDepositAmount, "0");  // 100k
      await deposit(investor2, firstDepositAmount, "0");  // 100k
      await deposit(investor3, firstDepositAmount, "0");  // 100k

      const _200k = BigNumber.from("200000000000"); //200k
      const txsFee = await vault.txsFee(firstDepositAmount * 3);
      const offchainAmount = Number(_200k) + Number(txsFee);
      const expectOplAccount = Number(txsFee) + Number(balanceusInvestor);

      // update opl account
      //update treasury account
      await vault.setTreasury(investor5.address);

      // fundTBillPurchase 200k
      await vault.fundTBillPurchase(usdc.address, _200k);
      // check balance treasury account
      await expect(await usdc.balanceOf(investor5.address)).to.equal(_200k);
      // check balance opl account
      await expect(await usdc.balanceOf(usInvestor.address)).to.equal(expectOplAccount);

      await expect(await vault._onchainFee()).to.equal(0);
      await expect(await vault._offchainFee()).to.equal(0);

      await requestEpochUpdate(offchainAmount);
      const onchainAssets = await usdc.balanceOf(vault.address);
      const onchainFee = (Number(onchainAssets) * Number(onchainServiceFeeRate)) / (365 * BPSUNIT);
      // console.log("onchainAssets: ", onchainAssets);
      // console.log("onchainAssets: ", await vault.totalAssets());
      // console.log("onchain fee1: ", onchainFee);
      // console.log("onchain fee2: ", await vault._onchainFee());

      const offchainAssets = (Number(offchainAmount) * Number(offchainServiceFeeRate)) / (365 * BPSUNIT);
      await expect(await vault._onchainFee()).to.equal(Number(onchainFee.toFixed(0)) - 1);
      await expect(await vault._offchainFee()).to.equal(Number(offchainAssets.toFixed(0)) - 1);

      await vault.claimOnchainServiceFee(await vault._onchainFee());
      await vault.claimOffchainServiceFee(await vault._offchainFee());

      await expect(await vault._onchainFee()).to.equal(0);
      await expect(await vault._offchainFee()).to.equal(0);

    });

    it("processWithdrawalQueue empty queue", async function () {
      await expect(vault.connect(investor1).processWithdrawalQueue()).to.revertedWith("permission denied");
      await expect(vault.connect(operator).processWithdrawalQueue()).to.revertedWith("queue is empty");
    });

    it("fundTBillPurchase abnormal case", async function () {
      const _10k = BigNumber.from("10000000000");
      await expect(vault.connect(investor1).fundTBillPurchase(usdc.address, _10k)).to.revertedWith("permission denied");
      await expect(vault.fundTBillPurchase(usdc.address, _10k)).to.revertedWith("insufficient amount");
      await vault.setTreasury("0x0000000000000000000000000000000000000000");
      await expect(vault.fundTBillPurchase(usdc.address, _10k)).to.revertedWith("invalid treasury");
    });

    it("claim onchainFee/offchainFee abnormal case", async function () {
      const _10k = BigNumber.from("10000000000");
      await vault.setOplServiceProvider("0x0000000000000000000000000000000000000000");
      await expect(vault.claimOnchainServiceFee(_10k)).to.revertedWith("invalid opl address");
      await expect(vault.claimOffchainServiceFee(_10k)).to.revertedWith("invalid opl address");
    });

    it("request update epoch, withdrawal queue abnormal case", async function () {
      const _10k = BigNumber.from("10000000000");
      await vault.connect(operator).requestUpdateEpoch();
      await expect(vault.connect(investor1).requestUpdateEpoch()).to.revertedWith("permission denied");
      await expect(vault.connect(operator).processWithdrawalQueue()).to.revertedWith("queue is empty");
      await expect(vault.connect(investor1).processWithdrawalQueue()).to.revertedWith("permission denied");
    });

    it("update new kycManager", async function () {
      // deploy kycManager
      const NewKycManager = await ethers.getContractFactory("KycManager");
      newKycManager = await NewKycManager.deploy();
      await newKycManager.deployed();
      await expect(vault.connect(investor1).setKycManager(newKycManager.address)).to.revertedWith(onlyOwnerMessage);
      await vault.setKycManager(newKycManager.address);
      await expect(deposit(investor1, firstDepositAmount, "0")).to.revertedWith("not a kyc user");  // 100k
    });

    it("update new base vault", async function () {
      const newTxsFee = 10;
      const newFirstDepositAmount = 2;
      const newMinDeposit = 3;
      const newMaxDeposit = 4;
      const newMaxWithdraw = 5;
      const newTargetReserverLevel = 6;
      const newOnchainFeeRate = 7;
      const newOffchainFeeRate = 8;

      const BaseVault = await ethers.getContractFactory("BaseVault");
      const newBaseVault = await BaseVault.deploy(
        newTxsFee, // 5 bps
        newFirstDepositAmount,
        newMinDeposit, // 100000 USDC
        newMaxDeposit, // max deposit on a day
        newMaxWithdraw, // max withdraw on a day
        newTargetReserverLevel, // 10%
        newOnchainFeeRate, // 40 bps
        newOffchainFeeRate, // 40 bps
      );
      await newBaseVault.deployed();

      await expect(await vault.txsFee(_100k)).to.equal(_50$);
      await expect(vault.connect(investor1).setBaseVault(newBaseVault.address)).to.revertedWith(onlyOwnerMessage);
      await vault.setBaseVault(newBaseVault.address);
      await expect(await vault.txsFee(_100k)).to.equal(_100$);
    });
  })
})

describe("Chainlink Oracle", function () {
  let owner, kysInvestor, usKysInvestor, nonKycInvestor;
  let baseVault;

  const newTxsFee = 1;
  const newFirstDepositAmount = 2;
  const newMinDeposit = 3;
  const newMaxDeposit = 4;
  const newMaxWithdraw = 5;
  const newTargetReserverLevel = 6;
  const newOnchainFeeRate = 7;
  const newOffchainFeeRate = 8;

  beforeEach(async function () {
    [owner, kysInvestor, usKysInvestor, nonKycInvestor, nonKycInvestor] = await ethers.getSigners();

    const minDeposit = BigNumber.from("10000000000"); // 10k
    const maxDeposit = BigNumber.from('1000000000000'); // 1M
    const maxWithdraw = BigNumber.from('1000000000000'); // 1M
    const firstDepositAmount = BigNumber.from("100000000000"); // 100k

    const transactionFee = 5; // 5bps
    const targetReservesLevel = 10; // 10%
    const onchainServiceFeeRate = 40; // 40bps
    const offchainServiceFeeRate = 40; // 40bps

    // deploy base vault contract
    const BaseVault = await ethers.getContractFactory("BaseVault");
    baseVault = await BaseVault.deploy(
      transactionFee, // 5 bps
      firstDepositAmount,
      minDeposit, // 100000 USDC
      maxDeposit, // max deposit on a day
      maxWithdraw, // max withdraw on a day
      targetReservesLevel, // 10%
      onchainServiceFeeRate, // 40 bps
      offchainServiceFeeRate, // 40 bps
    );
    await baseVault.deployed();
  });

  // ======= BASE VAULT===========
  it("setter/getter base vault role", async function () {
    await expect(baseVault.connect(kysInvestor).setTransactionFee(newTxsFee)).to.revertedWith("Ownable: caller is not the owner");
    await expect(baseVault.connect(kysInvestor).setFirstDeposit(newFirstDepositAmount)).to.revertedWith("Ownable: caller is not the owner");
    await expect(baseVault.connect(kysInvestor).setMinDeposit(newMinDeposit)).to.revertedWith("Ownable: caller is not the owner");
    await expect(baseVault.connect(kysInvestor).setMaxDeposit(newMaxDeposit)).to.revertedWith("Ownable: caller is not the owner");
    await expect(baseVault.connect(kysInvestor).setMaxWithdraw(newMaxWithdraw)).to.revertedWith("Ownable: caller is not the owner");
    await expect(baseVault.connect(kysInvestor).setTargetReservesLevel(newTargetReserverLevel)).to.revertedWith("Ownable: caller is not the owner");
    await expect(baseVault.connect(kysInvestor).setOnchainServiceFeeRate(newOnchainFeeRate)).to.revertedWith("Ownable: caller is not the owner");
    await expect(baseVault.connect(kysInvestor).setOffchainServiceFeeRate(newOffchainFeeRate)).to.revertedWith("Ownable: caller is not the owner");
  });

  it("setter/getter base vault role", async function () {
    await baseVault.setTransactionFee(newTxsFee)
    await expect(await baseVault.getTransactionFee()).to.equal(newTxsFee);
    await baseVault.setFirstDeposit(newFirstDepositAmount)
    await expect(await baseVault.getFirstDeposit()).to.equal(newFirstDepositAmount);

    await baseVault.setMinDeposit(newMinDeposit)
    await baseVault.setMaxDeposit(newMaxDeposit)
    await baseVault.setMaxWithdraw(newMaxWithdraw)
    const [minDeposit, maxDeposit] = await baseVault.getMinMaxDeposit();
    await expect(minDeposit).to.equal(newMinDeposit);
    await expect(maxDeposit).to.equal(newMaxDeposit);

    await baseVault.setTargetReservesLevel(newTargetReserverLevel)
    await expect(await baseVault.getTargetReservesLevel()).to.equal(newTargetReserverLevel);

    await baseVault.setOnchainServiceFeeRate(newOnchainFeeRate)
    await baseVault.setOffchainServiceFeeRate(newOffchainFeeRate)
    const [onchainFee, offchainFee] = await baseVault.getOnchainAndOffChainServiceFeeRate();
    await expect(onchainFee).to.equal(newOnchainFeeRate);
    await expect(offchainFee).to.equal(newOffchainFeeRate);
  });
});
