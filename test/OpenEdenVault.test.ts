const { numToBytes32 } = require("../helper-functions")
import { expect } from "chai";
import { describe } from "mocha";
import { BigNumber, Bytes } from "ethers";
import { deployContract } from "../helpers/framework/contracts";
import { successfulTransaction } from "../helpers/framework/transaction";
import { network } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { SignerWithAddress } from "@ethersproject/providers";

import { USDC, LinkToken, MockOracle, OpenEdenVault, BaseVault, KycManager } from '../typechain-types'

describe("OpenEden", async function () {
  const initBalanceInvestor = BigNumber.from('100000000000000'); // 10M
  const depositAmount = BigNumber.from("200000000000"); // 200k
  const withdrawAmount = BigNumber.from('50000000000');  // 50k

  const amountShares = BigNumber.from('50000000000');  // 50k
  const minDepositAmount = BigNumber.from('100000000000'); // 100k
  // const amountShare = BigNumber.from('999500');  // 100k
  // const amountRedeem = BigNumber.from('100000');  // 100k

  const decimals = 6; //
  const minDeposit = BigNumber.from("10000000000"); // 10k
  const maxDeposit = BigNumber.from('1000000000000'); // 1M
  const maxWithdraw = BigNumber.from('1000000000000'); // 1M
  const firstDepositAmount = BigNumber.from("100000000000"); // 100k
  const chainlinkJobId = ethers.utils.toUtf8Bytes("29fa9aa13bf1468788b7cc4a500a1234")
  const chainlinkFee = "100000000000000000"
  const fundAmount = "10000000000000000000"

  const transactionFee = 5; // 5bps
  const targetReservesLevel = 10; // 10%
  const onchainServiceFeeRate = 40; // 40bps
  const offchainServiceFeeRate = 40; // 40bps
  const minTxsFee = 25;// 25$
  const BPSUNIT = 10000;

  let usdcTokenIns: USDC
  let linkTokenIns: LinkToken
  let mockOracleIns: MockOracle
  let baseVaultIns: BaseVault
  let kycManagerIns: KycManager
  let openEdenVaultIns: OpenEdenVault

  const [owner, investor1, investor2, investor3, investor4, non_kyc, operator, treasuryAccount, oplServiceProvider]
    = await ethers.getSigners();

  async function deployOpenEdenFixture() {
    const vaultParameters = {
      transactionFee: transactionFee, // 5 bps
      firstDeposit: firstDepositAmount,
      minDeposit: minDeposit, // 100000 USDC
      maxDeposit: maxDeposit, // max deposit on a day
      maxWithdraw: maxWithdraw, // max withdraw on a day
      targetReservesLevel: targetReservesLevel, // 10%
      onchainServiceFeeRate: onchainServiceFeeRate, // 40 bps
      offchainServiceFeeRate: offchainServiceFeeRate, // 40 bps
    }

    const chainlinkParameters = {
      jobId: chainlinkJobId,
      fee: chainlinkFee,
      urlData: "https://openeden-node.vercel.app/vault/assets/offchain",
      pathToOffchainAssets: "totalOffChainAssets",
      pathToTotalOffchainAssetAtLastClose: "pathToTotalOffchainAssetAtLastClose"
    }

    usdcTokenIns = await deployContract<USDC>("USDC")
    linkTokenIns = await deployContract<LinkToken>("LinkToken")
    mockOracleIns = await deployContract<MockOracle>("MockOracle", linkTokenIns.address)
    kycManagerIns = await deployContract<KycManager>("KycManager")
    baseVaultIns = await deployContract<BaseVault>("BaseVault",
      vaultParameters.transactionFee,
      vaultParameters.firstDeposit,
      vaultParameters.minDeposit,
      vaultParameters.maxDeposit,
      vaultParameters.maxWithdraw,
      vaultParameters.targetReservesLevel,
      vaultParameters.onchainServiceFeeRate,
      vaultParameters.offchainServiceFeeRate)
    openEdenVaultIns = await deployContract<OpenEdenVault>("OpenEdenVault")

    await openEdenVaultIns.initialize(
      usdcTokenIns.address,
      operator.address,
      oplServiceProvider.address,
      treasuryAccount.address,
      baseVaultIns.address,
      kycManagerIns.address,
      linkTokenIns.address,
      mockOracleIns.address,
      chainlinkParameters
    );

    await linkTokenIns.transfer(openEdenVaultIns.address, fundAmount)
    await usdcTokenIns.transfer(investor1.address, initBalanceInvestor);
    await usdcTokenIns.transfer(investor2.address, initBalanceInvestor);
    await usdcTokenIns.transfer(investor3.address, initBalanceInvestor);
    await usdcTokenIns.transfer(investor4.address, initBalanceInvestor);
    await usdcTokenIns.transfer(non_kyc.address, initBalanceInvestor);
    await usdcTokenIns.connect(investor1).approve(openEdenVaultIns.address, initBalanceInvestor);
    await usdcTokenIns.connect(investor2).approve(openEdenVaultIns.address, initBalanceInvestor);
    await usdcTokenIns.connect(investor3).approve(openEdenVaultIns.address, initBalanceInvestor);
    await usdcTokenIns.connect(investor4).approve(openEdenVaultIns.address, initBalanceInvestor);
    await usdcTokenIns.connect(non_kyc).approve(openEdenVaultIns.address, initBalanceInvestor);

    // 0: NON KYC, 1: US KYC, 2: GENERAL KYC 
    await kycManagerIns.grantKycInBulk([
      investor1.address, investor2.address, investor3.address, investor4.address],
      [2, 2, 2, 1]);
    await linkTokenIns.transfer(openEdenVaultIns.address, fundAmount);
    console.log("deployOpenEdenFixture over!");
  };

  beforeEach(async () => {
    await loadFixture(deployOpenEdenFixture);
  });

  async function callOracle(receipt: any, totalOffChainAssets: any, eventTopic: any) {
    const parsedLogs = receipt.logs
      .filter(log => log.topics[0] === eventTopic)
      .map(log => openEdenVaultIns.interface.parseLog(log));

    if (parsedLogs.length > 0) {
      const requestId = parsedLogs[0].args['requestId']

      // console.log('requestId:', requestId);
      const callbackValue = BigNumber.from(totalOffChainAssets);
      return await mockOracleIns.fulfillOracleRequest(requestId, numToBytes32(callbackValue));
    }
  }

  async function deposit(invertor, depositAmount, totalOffChainAssets) {
    const transaction = await openEdenVaultIns.connect(invertor).deposit(depositAmount, invertor.address);
    const eventTopic = openEdenVaultIns.interface.getEventTopic('RequestDeposit')
    const receipt = await successfulTransaction(transaction)
    await callOracle(receipt, totalOffChainAssets, eventTopic)
    let b1 = await openEdenVaultIns.balanceOf(investor1.address)
  }

  async function withdraw(invertor, amount, totalOffChainAssets) {
    const transaction = await openEdenVaultIns.connect(invertor).withdraw(amount, invertor.address, invertor.address);
    const receipt = await successfulTransaction(transaction)
    const eventTopic = openEdenVaultIns.interface.getEventTopic('RequestWithdraw')
    await callOracle(receipt, totalOffChainAssets, eventTopic)
  }

  async function requestEpochUpdate(totalOffChainAssets) {
    const transaction = await openEdenVaultIns.requestUpdateEpoch();
    const eventTopic = openEdenVaultIns.interface.getEventTopic('RequestUpdateEpoch')
    const receipt = await successfulTransaction(transaction)
    await callOracle(receipt, totalOffChainAssets, eventTopic)
  }

  async function processWithdrawalQueue(totalOffChainAssets) {
    const transaction = await openEdenVaultIns.processWithdrawalQueue();
    const receipt = await successfulTransaction(transaction)
    const eventTopic = openEdenVaultIns.interface.getEventTopic('RequestWithdrawalQueue')
    await callOracle(receipt, totalOffChainAssets, eventTopic)
  }

  describe.only('basic test by Minh', () => {
    it("deposit and withdraw, queue check ", async function () {
      // deposit
      await deposit(investor1, firstDepositAmount, "0");
      console.log('firstDepositAmount:', firstDepositAmount);

      // let bal1 = await openEdenVaultIns.balanceOf(investor1.address)
      // console.log("bal for investor1:", bal1);

      // // queue check
      // expect(await openEdenVaultIns.getWithdrawalQueueLength()).to.equal(0);
      // await withdraw(investor1, bal1, firstDepositAmount.mul(2));
      // expect(await openEdenVaultIns.getWithdrawalQueueLength()).to.equal(1);
      // bal1 = await openEdenVaultIns.balanceOf(investor1.address)
      // console.log("bal for investor1:", bal1.toString());

      // const info = await openEdenVaultIns.getWithdrawalQueueInfo(0)
      // console.log('info:', info);
    });

    it("txs fee check", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");
      let expectedTxFee = await openEdenVaultIns.txsFee(firstDepositAmount);
      let txFee = firstDepositAmount.mul(await baseVaultIns.getTransactionFee()).div(BPSUNIT);
      expect(txFee).to.equal(expectedTxFee);

      // investor2 deposit
      await deposit(investor2, firstDepositAmount, "0");
      expectedTxFee = expectedTxFee.add(await openEdenVaultIns.txsFee(firstDepositAmount));
      txFee = txFee.add(firstDepositAmount.mul(await baseVaultIns.getTransactionFee()).div(BPSUNIT));
      expect(txFee).to.equal(expectedTxFee);
    });

    it("deposit, totalSupply, totalAssets, opl account check", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");

      let txFee = await openEdenVaultIns.txsFee(firstDepositAmount);
      let expectedBalance = firstDepositAmount.sub(txFee);
      console.log("usdc deposit: " + firstDepositAmount);
      console.log("txFee: " + txFee);
      console.log("t-bill received: " + expectedBalance);

      expect(await openEdenVaultIns.balanceOf(investor1.address)).to.equal(expectedBalance);

      await deposit(investor2, firstDepositAmount.mul(2), "0");
      expect(await openEdenVaultIns.balanceOf(investor2.address)).to.equal(expectedBalance.mul(2));

      // total supply
      console.log("t-bill received investor2: " + await openEdenVaultIns.balanceOf(investor2.address));
      expect(await openEdenVaultIns.totalAssets()).to.equal(expectedBalance.mul(3));

      // total assets
      const expectedTotalSupply = expectedBalance.mul(3);
      expect(await openEdenVaultIns.totalSupply()).to.equal(expectedTotalSupply);

      // total usdc in vault
      const expectedUsdcInVault = (firstDepositAmount.mul(3)).sub(await openEdenVaultIns.txsFee(firstDepositAmount.mul(3)));
      expect(await usdcTokenIns.balanceOf(openEdenVaultIns.address)).to.equal(expectedUsdcInVault);

      // txs fee on oplServiceProvider account
      txFee = await openEdenVaultIns.txsFee(firstDepositAmount.mul(3));
      expect(await usdcTokenIns.balanceOf(oplServiceProvider.address)).to.equal(txFee);

    });

    it("withdraw, opl account check", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");
      // investor2 deposit
      await deposit(investor2, firstDepositAmount.mul(3), "0");
      const tbillInvestor1 = await openEdenVaultIns.balanceOf(investor1.address);
      // investor1 withdraw
      await withdraw(investor1, tbillInvestor1, "0");
      expect(await openEdenVaultIns.balanceOf(investor1.address)).to.equal(0);
      // investor2 withdraw
      const tbillInvestor2 = await openEdenVaultIns.balanceOf(investor2.address);
      await withdraw(investor2, tbillInvestor2, "0");
      expect(await openEdenVaultIns.balanceOf(investor2.address)).to.equal(0);
      // check usdc balance of opl account
      const txFee = await openEdenVaultIns.txsFee(firstDepositAmount.mul(4));
      expect(await usdcTokenIns.balanceOf(oplServiceProvider.address)).to.equal(txFee);
    });

    it("deposit, queue length", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");
      // investor2 deposit2
      await deposit(investor2, firstDepositAmount, "0");
      console.log("balance investor1: ", await openEdenVaultIns.balanceOf(investor1.address));
      console.log("balance investor2: ", await openEdenVaultIns.balanceOf(investor2.address));
      expect(await openEdenVaultIns._onchainFee()).to.equal(0);
      expect(await openEdenVaultIns._offchainFee()).to.equal(0);

      expect(await openEdenVaultIns._epoch()).to.equal(0);
      let latestOffchainAssets = firstDepositAmount;

      // onchain fee claimable 
      let totalOnchainAssets = await openEdenVaultIns.totalAssets();
      console.log("totalAssetsAvailable: " + totalOnchainAssets);

      await requestEpochUpdate(latestOffchainAssets);
      expect(await openEdenVaultIns._epoch()).to.equal(1);
      await deposit(investor3, firstDepositAmount, firstDepositAmount);
      console.log("balance investor3: ", await openEdenVaultIns.balanceOf(investor3.address));

      // onchain/offchain service fee ===
      const [onchainFee, offchainFee] = await baseVaultIns.getOnchainAndOffChainServiceFeeRate();
      expect(onchainFee).to.equal(onchainServiceFeeRate);
      expect(offchainFee).to.equal(offchainServiceFeeRate);
      // ====

      // onchain fee claimable 
      // const onchainFeeClaimable = (totalOnchainAssets * onchainFee) / (356 * BPSUNIT)
      // expect(onchainFeeClaimable).to.equal(Number(await openEdenVaultIns._onchainServiceFeeClaimable()));
    });

    it("deposit, epoch counter, queue length, fundTBillPurchase, treasury account check", async function () {
      // investor1 deposit
      await deposit(investor1, firstDepositAmount, "0");
      // investor2 deposit2
      await deposit(investor2, firstDepositAmount, "0");
      const actualAsset = firstDepositAmount.sub(await openEdenVaultIns.txsFee(firstDepositAmount));
      let estimateAmount = await openEdenVaultIns.previewDeposit(firstDepositAmount);
      console.log("estimateAmount1: ", estimateAmount);

      await openEdenVaultIns.fundTBillPurchase(usdcTokenIns.address, actualAsset);
      expect(await usdcTokenIns.balanceOf(treasuryAccount.address)).to.equal(actualAsset);
      await requestEpochUpdate(actualAsset);
      estimateAmount = await openEdenVaultIns.previewDeposit(firstDepositAmount);
      console.log("estimateAmount2: ", estimateAmount);
      await requestEpochUpdate(actualAsset);
      estimateAmount = await openEdenVaultIns.previewDeposit(firstDepositAmount);
      console.log("estimateAmount3: ", estimateAmount);
      expect(await openEdenVaultIns._epoch()).to.equal(2);
    });


    it("not a kyc user", async function () {
      await kycManagerIns.revokeKycInBulk([investor1.address]);
      expect(openEdenVaultIns.connect(investor1).deposit(firstDepositAmount, investor1.address)).to.revertedWith("not a kyc user");
      expect(openEdenVaultIns.connect(non_kyc).deposit(firstDepositAmount, non_kyc.address)).to.revertedWith("not a kyc user");
    });

    it("revoke kyc than grantKycInBulk", async function () {
      await kycManagerIns.revokeKycInBulk([investor1.address]);
      await kycManagerIns.grantKycInBulk([investor1.address], [1]);
      await deposit(investor1, firstDepositAmount, "0");
    });

    it("us kyc deposit, and transfer to non kyc", async function () {
      await deposit(investor4, firstDepositAmount, "0");
      const amountTbillTransfer = "10000000000"; // 10k
      await openEdenVaultIns.connect(investor4).transfer(investor1.address, amountTbillTransfer);
      await expect(openEdenVaultIns.connect(investor4).transfer(non_kyc.address, amountTbillTransfer)).to.be.revertedWith("not a kyc user");
    });

    it("generis kyc deposit, and transfer to non kyc", async function () {
      await deposit(investor1, firstDepositAmount, "0");
      const amountTbillTransfer = "10000000000"; // 10k
      await openEdenVaultIns.connect(investor1).transfer(non_kyc.address, amountTbillTransfer);
    });
  })

  describe('Basic test cases by Duke', () => {
    it("Test case 6: Check if deposit is rejected if it exceeds the daily max limit", async function () {
      await deposit(investor1, maxDeposit, "0");
      await expect(deposit(investor1, firstDepositAmount, "0")).to.be.revertedWith("deposit too much 1");
    });

    it("Test case 7: Check if deposit is rejected if it is below the daily min limit", async function () {
      await expect(deposit(investor1, minDeposit.div(2), "0")).to.be.revertedWith("amount lt minimum deposit")
    });

    it("Test case 8: Check if deposit is rejected for a non-KYC investor", async function () {
      await kycManagerIns.revokeKycInBulk([investor1.address]);
      await expect(deposit(investor1, firstDepositAmount, "0")).to.be.revertedWith("not a kyc user");
    });

    it("Test case 9: Check if withdraw is rejected if it exceeds the daily max limit", async function () {
      await deposit(investor1, maxDeposit, "0");
      await requestEpochUpdate(firstDepositAmount)
      await deposit(investor1, maxDeposit, "0");
      await requestEpochUpdate(firstDepositAmount)
      await deposit(investor1, maxDeposit, "0");
      await expect(withdraw(investor1, maxWithdraw.mul(2).add(1), "0")).to.be.revertedWith("withdraw too much 1")
    });
  })

  async function transferToken(from, to, amount) {
    await openEdenVaultIns.connect(from).transfer(to.address, amount);
  }

  async function balanceOfToken(from) {
    return await openEdenVaultIns.balanceOf(from)
  }

  async function setKyc(investor, kycType) {
    await kycManagerIns.connect(owner).grantKycInBulk([investor.address], [kycType]);
  }
  async function unsetKyc(investor) {
    await kycManagerIns.connect(owner).revokeKycInBulk([investor.address])
  }

  async function banInvestor(investor) {
    await kycManagerIns.connect(owner).bannedInBulk([investor.address]);
  }

  async function unbanInvestor(investor) {
    await kycManagerIns.connect(owner).unBannedInBulk([investor.address]);
  }

  async function setStrict(status) {
    await kycManagerIns.connect(owner).setStrict(status);
  }

  describe('Token Transfer Control', () => {
    it("Test case 1: Successfully transfer tokens between non-US KYC-approved investors", async function () {
      const transferAmount = ethers.utils.parseEther("100");

      await setKyc(investor1, 2); // GENERAL_KYC
      await setKyc(investor2, 2); // GENERAL_KYC

      await deposit(investor1, firstDepositAmount, "0");
      const bal = await balanceOfToken(investor1.address)
      await transferToken(investor1, investor2, bal);

      const investor2Balance = await openEdenVaultIns.balanceOf(investor2.address);
      expect(investor2Balance).to.equal(bal);
    });

    it("Test case 2: Successfully transfer tokens between US KYC-approved investors", async function () {
      await setKyc(investor1, 1); // US_KYC
      await setKyc(investor2, 1); // US_KYC

      await deposit(investor1, firstDepositAmount, "0");
      const bal = await balanceOfToken(investor1.address)
      await transferToken(investor1, investor2, bal);

      const investor2Balance = await openEdenVaultIns.balanceOf(investor2.address);
      expect(investor2Balance).to.equal(bal);
    });

    it("Test case 3: Successfully transfer tokens from a non-KYC-approved sender", async function () {
      await setKyc(investor2, 2); // GENERAL_KYC
      await deposit(investor1, firstDepositAmount, "0");
      const bal = await balanceOfToken(investor1.address)
      transferToken(investor1, non_kyc, bal)
      transferToken(non_kyc, investor2, bal)
    });

    it("Test case 4: Fail transfer tokens from us-KYC-approved investors to non-KYC-approved", async function () {
      await setKyc(investor1, 1); // US_KYC
      await deposit(investor1, firstDepositAmount, "0");
      const bal = await balanceOfToken(investor1.address)
      await expect(transferToken(investor1, non_kyc, bal)).to.be.revertedWith("not a kyc user");
    });

    it("Test case 5: Successfully transfer tokens between US KYC-approved and non-US KYC-approved investors", async function () {
      await setKyc(investor1, 1); // US_KYC
      await setKyc(investor2, 2); // GENERAL_KYC

      await deposit(investor1, firstDepositAmount, "0");
      const bal = await balanceOfToken(investor1.address)
      await transferToken(investor1, investor2, bal);

      const investor2Balance = await openEdenVaultIns.balanceOf(investor2.address);
      expect(investor2Balance).to.equal(bal);
    });

    it("Test case 6: Fail transfer tokens between banned investors", async function () {
      await setKyc(investor1, 2); // GENERAL_KYC
      await setKyc(investor2, 2); // GENERAL_KYC

      await banInvestor(investor1);
      await banInvestor(investor2);

      await expect(deposit(investor1, firstDepositAmount, "0")).to.be.revertedWith("user is banned");
    });

    it("Test case 7: Fail transfer tokens from a banned investor", async function () {
      await setKyc(investor1, 2); // GENERAL_KYC
      await setKyc(investor2, 2); // GENERAL_KYC

      await banInvestor(investor1);
      await expect(deposit(investor1, firstDepositAmount, "0")).to.be.revertedWith("user is banned")
    });

    it("Test case 8: Fail transfer tokens to a banned investor", async function () {
      const transferAmount = ethers.utils.parseEther("100");

      await setKyc(investor1, 2); // GENERAL_KYC
      await setKyc(investor2, 2); // GENERAL_KYC

      await banInvestor(investor2);

      await deposit(investor1, firstDepositAmount, "0");
      const bal = await balanceOfToken(investor1.address)
      await expect(transferToken(investor1, investor2, bal)).to.be.revertedWith("user is banned");
    });

    it("Test case 9: Fail transfer tokens between non-KYC-approved investors when strict mode is on", async function () {
      await setStrict(true);

      await deposit(investor1, firstDepositAmount, "0");
      const bal = await balanceOfToken(investor1.address)
      await expect(transferToken(investor1, non_kyc, bal)).to.be.revertedWith("not a kyc user");
    });

    it("Test case 10: Fail transfer tokens between non-KYC-approved investors when strict mode is on", async function () {
      await setStrict(true);

      await deposit(investor1, firstDepositAmount, "0");
      const bal = await balanceOfToken(investor1.address)
      await expect(transferToken(investor1, non_kyc, bal)).to.be.revertedWith("not a kyc user");
    });

    it("Test case 10: Fail transfer tokens between non-KYC-approved investors when strict mode is on", async function () {
      await setStrict(true);
      await setStrict(false);
      await deposit(investor1, firstDepositAmount, "0");
      const bal = await balanceOfToken(investor1.address)
      transferToken(investor1, non_kyc, bal);
    });

  })
})