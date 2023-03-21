// const {
//     time,
//     loadFixture
//   } = require("@nomicfoundation/hardhat-network-helpers");
// const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
// const { expect } = require("chai");
// const { ethers } = require("hardhat");
// const { isDebuggerStatement } = require("typescript");
// const { networkConfig, developmentChains } = require("../helper-hardhat-config")
// const { numToBytes32 } = require("../helper-functions")
  
// describe("Init contract", function () {
//     // We define a fixture to reuse the same s
//     let apiConsumer;
//     let mockOracle;
//     let owner, operator, coinbaseAccount, oplServiceProvider, investor1, investor2, investor3, investor4, investor5;
//     let usdc, vault, linkToken;
//     const initBalanceInvestor = ethers.utils.parseEther('1000000'); // 10M
//     const depositAmount = ethers.utils.parseEther('100000'); // 100k
    
//     const withdrawAmount = ethers.utils.parseEther('50000');  // 50k
//     const amountShares = ethers.utils.parseEther('50000');  // 50k

//     const minDepositAmount = ethers.utils.parseEther('10000'); // 1M
//     const amountShare = ethers.utils.parseEther('999500');  // 100k
//     const amountRedeem = ethers.utils.parseEther('100000');  // 100k

//     const bpsUnit = 10000;  // 500k
//     const decimals = 6; //
//     const minDeposit = ethers.utils.parseEther('10000'); // 100k
//     const maxDeposit = ethers.utils.parseEther('1000000'); // 1M
//     const maxWithdraw = ethers.utils.parseEther('1000000'); // 1M
//     const firstDepositAmount = ethers.utils.parseEther('100000'); // 100k

//     const transactionFee = 5; // 5bps base on weekday or weekend 
//     // const transactionFeeWeekdayRate = 5; // 5bps
//     // const transactionFeeWeekendRate = 10; // 5bps
//     const targetReservesLevel = 10; // 10%
//     const onchainServiceFeeRate = 40; // 40bps
//     const offchainServiceFeeRate = 40; // 40bps

//     const minTxsFee = 25;// 25$

//     beforeEach(async function ()  {
//       [owner, investor1, investor2, investor3, investor4, investor5, operator, coinbaseAccount, oplServiceProvider] = await ethers.getSigners();

//       const USDC = await ethers.getContractFactory("USDC");
//       usdc = await USDC.deploy();
//       await usdc.deployed();
      
//       const chainId = "default";

//       const linkTokenFactory = await ethers.getContractFactory("LinkToken")
//       linkToken = await linkTokenFactory.deploy()
//       await linkToken.deployed();

//       const mockOracleFactory = await ethers.getContractFactory("MockOracle")
//       mockOracle = await mockOracleFactory.deploy(linkToken.address)
//       await mockOracle.deployed();


//       const chainlinkJobId = ethers.utils.toUtf8Bytes("29fa9aa13bf1468788b7cc4a500a1234")
//       const chainlinkFee = "100000000000000000"
      
//       // ==============
//       const apiConsumerFactory = await ethers.getContractFactory("APIConsumer")
//       apiConsumer = await apiConsumerFactory
//           .deploy(mockOracle.address, chainlinkJobId, chainlinkFee, linkToken.address)
      
//       await apiConsumer.deployed();
//       // ==============
//       const fundAmount = "10000000000000000000"
//       await linkToken.transfer(apiConsumer.address, fundAmount)

//       const vaultParameters = {
//         transactionFee: transactionFee, // 5 bps
//         // transactionFeeWeekdayRate: transactionFeeWeekdayRate, // 5 bps
//         // transactionFeeWeekendRate: transactionFeeWeekendRate, // 10 bps
//         firstDeposit: firstDepositAmount,
//         minDeposit: minDeposit, // 100000 USDC
//         maxDeposit: maxDeposit, // max deposit on a day
//         maxWithdraw: maxWithdraw, // max withdraw on a day
//         targetReservesLevel: targetReservesLevel, // 10%
//         onchainServiceFeeRate: onchainServiceFeeRate, // 40 bps
//         offchainServiceFeeRate: offchainServiceFeeRate, // 40 bps
//         decimals: decimals // 6
//       }

//       const chainlinkParameters = {
//           jobId: chainlinkJobId,
//           fee: chainlinkFee,
//           urlData: "https://openeden-node.vercel.app/vault/assets/offchain",
//           pathToOffchainAssets: "totalOffChainAssets",
//           pathToTotalOffchainAssetAtLastClose: "totalOffChainAssetsAtLastClose"
//       }

//       // deploy vault contract
//       const Vault = await ethers.getContractFactory("OpenEdenVault");

//       vault = await Vault.deploy(
//         usdc.address,
//         operator.address,
//         oplServiceProvider.address,
//         coinbaseAccount.address,
//         vaultParameters,
//         chainlinkParameters,
//         linkToken.address,
//         mockOracle.address
//       );

//       await vault.deployed();

//       // transfer usdc to investor
//       await usdc.transfer(investor1.address, initBalanceInvestor);
//       await usdc.transfer(investor2.address, initBalanceInvestor);
//       await usdc.transfer(investor3.address, initBalanceInvestor);
//       await usdc.transfer(investor4.address, initBalanceInvestor);
//       await usdc.transfer(investor5.address, initBalanceInvestor);
//       await usdc.connect(investor1).approve(vault.address, initBalanceInvestor);
//       await usdc.connect(investor2).approve(vault.address, initBalanceInvestor);
//       await usdc.connect(investor3).approve(vault.address, initBalanceInvestor);
//       await usdc.connect(investor4).approve(vault.address, initBalanceInvestor);
//       await usdc.connect(investor5).approve(vault.address, initBalanceInvestor);

//       // whitelist investor
//       await vault.whitelistNonUsInvestor(investor1.address, true);
//       await vault.whitelistNonUsInvestor(investor2.address, true);
//       await vault.whitelistNonUsInvestor(investor3.address, true);
//       // fund link
//       await linkToken.transfer(vault.address, fundAmount);
//       //await vault.connect(investor1).approve(vault.address, initBalanceInvestor);
//     });

//     async function deposit(invertor, depositAmount, totalOffChainAssets) {
//       const transaction = await vault.connect(invertor).deposit(depositAmount, invertor.address);
//       const transactionReceipt = await transaction.wait(1)
//       const requestId = transactionReceipt.events[0].topics[1]
//       // current off-chain assets
//       const callbackValue = ethers.utils.parseEther(totalOffChainAssets);
//       await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
//     }

//     async function withdraw(invertor, depositAmount, totalOffChainAssets) {
//       const transaction = await vault.connect(invertor).withdraw(depositAmount, invertor.address, invertor.address);
//       const transactionReceipt = await transaction.wait(1)
//       const requestId = transactionReceipt.events[0].topics[1]
//       // current off-chain assets
//       const callbackValue = ethers.utils.parseEther(totalOffChainAssets);
//       await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
//     }

//     async function processEpochUpdate(totalOffChainAssets) {
//       // pause
//       const transaction = await vault.requestUpdateEpoch();
//       // unpause
//       const transactionReceipt = await transaction.wait(1)
//       const requestId = transactionReceipt.events[0].topics[1]
//       // current off-chain assets
//       const callbackValue = ethers.utils.parseEther(totalOffChainAssets);
//       await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
//     }

//     async function processWithdrawalQueue(totalOffChainAssets) {
//       const transaction = await vault.processWithdrawalQueue();
//       const transactionReceipt = await transaction.wait(1)
//       const requestId = transactionReceipt.events[0].topics[1]
//       // current off-chain assets
//       const callbackValue = ethers.utils.parseEther(totalOffChainAssets);
//       await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
//     }

//     async function currentExchangeRate() {
//       const currentEpoch = await vault._epoch();
//       const currentExchangeRate = await vault._exchangeRate(currentEpoch);
//       return currentExchangeRate;
//     }
  
//     it("Initial requestId", async function () {
//         const transaction = await apiConsumer.requestVolumeData()
//         const transactionReceipt = await transaction.wait(1)
//         const requestId = transactionReceipt.events[0].topics[1]
//         expect(requestId).to.not.be.null
//     });

//     it("Should successfully make an API request and get a result", async function () {
//         const transaction = await apiConsumer.requestVolumeData()
//         const transactionReceipt = await transaction.wait(1)
//         const requestId = transactionReceipt.events[0].topics[1]
//         const callbackValue = 777
//         await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
//         const volume = await apiConsumer.volume()
//         expect(volume.toString()).to.equal(callbackValue.toString());
//     });

//     it("Initial variables vault parameters", async function () {
//       expect(await usdc.balanceOf(investor1.address)).to.equal(initBalanceInvestor);
//       expect(await usdc.balanceOf(investor2.address)).to.equal(initBalanceInvestor);
//       let result = await vault._vaultParameters();
//       // check vault parameters after deploy contract
//       expect(result.minDeposit).to.equal(minDeposit);
//       expect(result.decimals).to.equal(decimals);
//       expect(result.maxDeposit).to.equal(maxDeposit);
//       expect(result.maxWithdraw).to.equal(maxWithdraw);
//       expect(result.transactionFee).to.equal(transactionFee);
//       // expect(result.transactionFeeWeekdayRate).to.equal(transactionFeeWeekdayRate);
//       // expect(result.transactionFeeWeekendRate).to.equal(transactionFeeWeekendRate);
//       expect(result.targetReservesLevel).to.equal(targetReservesLevel);
//       expect(result.onchainServiceFeeRate).to.equal(onchainServiceFeeRate);
//       expect(result.offchainServiceFeeRate).to.equal(offchainServiceFeeRate);
//       expect(await vault._coinbaseAccount()).to.equal(coinbaseAccount.address);
//       expect(await vault._oplServiceProvider()).to.equal(oplServiceProvider.address);
//     });

//     it("Add Whitelist, Remove Whitelist", async function () {
//       expect(await vault.checkNonUsWhitelist(investor1.address)).to.equal(true);
//       await vault.whitelistNonUsInvestor(investor1.address, false);
//       expect(await vault.checkNonUsWhitelist(investor1.address)).to.equal(false);
//       await vault.whitelistNonUsInvestor(investor1.address, true);
//       expect(await vault.checkNonUsWhitelist(investor1.address)).to.equal(true);
//     });

//     it("Deposit USDC", async function () {
//       await deposit(investor1, depositAmount, "0")
//       // check txs fee of oplServiceProvider account
//       let txsFeeAmount = ethers.utils.formatEther(await usdc.balanceOf(oplServiceProvider.address)); // 500
//       let txsFeeExpected = depositAmount.mul((await vault._vaultParameters()).transactionFee) / bpsUnit; // 1M * (5bps / 10000)
//       txsFeeExpected = ethers.utils.formatEther(txsFeeExpected.toString());
//       expect(txsFeeAmount).to.equal(Number(txsFeeExpected).toFixed(1));
//       // check balance shares(t-bill) of investor1 
//       const amountTBillInvestor1 = depositAmount.sub(await vault.txsFee(depositAmount));
//       expect(await vault.balanceOf(investor1.address)).to.equal(amountTBillInvestor1);
//       // check balance usdc of investor1
//       const remainingAmount = initBalanceInvestor.sub(depositAmount);
//       expect(await usdc.balanceOf(investor1.address)).to.equal(remainingAmount);
//       // check balance usdc of vault
//       expect(await usdc.balanceOf(vault.address)).to.equal(depositAmount.sub( await usdc.balanceOf(oplServiceProvider.address) ));

//       await deposit(investor2, depositAmount, "0")
//       // check balance t-bill of investor2
//       const amountTBillInvestor2 = depositAmount.sub(await vault.txsFee(depositAmount));
//       expect(await vault.balanceOf(investor2.address)).to.equal(amountTBillInvestor2);
//       //check balance usdc of vault
//       let totalVaultExpected = depositAmount.sub(await vault.txsFee(depositAmount));
//       totalVaultExpected = ethers.utils.formatEther(totalVaultExpected) * 2;
//       expect(ethers.utils.formatEther(await usdc.balanceOf(vault.address))).to.equal(Number(totalVaultExpected).toFixed(1));
//       // check total t-bill minted
//       const expectedTotalTBill = Number(ethers.utils.formatEther(await vault.balanceOf(investor2.address))) + Number(ethers.utils.formatEther(await vault.balanceOf(investor1.address)));
//       expect(ethers.utils.formatEther(await vault.totalSupply())).to.equal(expectedTotalTBill.toFixed(1));
//       // check usdc balance fee account
//       const expectedFeeAmount = Number(ethers.utils.formatEther(await vault.txsFee(depositAmount))) * 2;
//       expect(ethers.utils.formatEther(await usdc.balanceOf(oplServiceProvider.address))).to.equal(expectedFeeAmount.toFixed(1));
//     });

//     it("Withdraw USDC", async function () {
//     await deposit(investor1, depositAmount, "0")
//     await deposit(investor2, depositAmount, "0")

//     const totalTBill = await vault.totalSupply();
//    // investor1 withdraw 500k t-bill
//     const currentBalanceInvestor1 = await usdc.balanceOf(investor1.address);
//     const currentTBillInvestor1 = await vault.balanceOf(investor1.address);
//     //await vault.connect(investor1).withdraw(withdrawAmount, investor1.address, investor1.address);
//     await withdraw(investor1, withdrawAmount, "0")
//     // check expected usdc balance after withdraw
//     const expectedBalanceInvestor1AfterWithdraw = currentBalanceInvestor1.add(withdrawAmount);
//     expect(await usdc.balanceOf(investor1.address)).to.equal(expectedBalanceInvestor1AfterWithdraw);
//     // check t-bill usdc balance after withdraw
//     expect(await vault.balanceOf(investor1.address)).to.equal(currentTBillInvestor1.sub(withdrawAmount));
//     });

//     it("Trading on 2 days ", async function () {
//       // deposit
//       await deposit(investor1, depositAmount, "0");
//       await deposit(investor2, depositAmount, "0");
//       // transfer usdc to coinbase account
//       const totalVaultUSDC = Number(ethers.utils.formatEther(await usdc.balanceOf(vault.address)));
//       const ninetyPercentVault = totalVaultUSDC - (totalVaultUSDC * targetReservesLevel / 100); // 90% of total usdc on vault
//       // withdraw 90% usdc from vault to coinbase account
//       const offRamAmount = ninetyPercentVault.toString();
//       await vault.fundTBillPurchase(ethers.utils.parseEther(offRamAmount));
      
//       console.log("offRamAmount:" + offRamAmount);
//       // cut-off time
//       await processEpochUpdate(ninetyPercentVault.toString());
//       // trade on next day
//       const currentEpoch = await vault._epoch();
//       const currentExchangeRate = await vault._exchangeRate(currentEpoch);
//       const assets = await vault['previewRedeem(uint256,uint256)'](amountShares, currentExchangeRate);
      
//       console.log("currentExchangeRate:" + currentExchangeRate);

//       const expectedBalanceAfterWithdraw = (await usdc.balanceOf(investor1.address)).add(await usdc.balanceOf(vault.address));
//       const expectedBalanceAfterFinishWithdrawal = (await usdc.balanceOf(investor1.address)).add(assets);

//       const expectedTBillRemaining = (await vault.totalSupply()).sub(assets);
//       const expectedTBillInvestor1 = (await vault.balanceOf(investor1.address)).sub(amountShares);
//       // investor1 withdraw
//       await withdraw(investor1, amountShares, offRamAmount);
//       expect(await usdc.balanceOf(investor1.address)).to.equal(expectedBalanceAfterWithdraw);
//       // investor3 deposit
//       await deposit(investor3, depositAmount, offRamAmount);

//       console.log("tbill balance investor3: " + await vault.balanceOf(investor3.address));

//       // process withdraw queue
//       await processWithdrawalQueue(offRamAmount);
//       expect((await usdc.balanceOf(investor1.address)).div("1000000000000000")).to.equal(expectedBalanceAfterFinishWithdrawal.div("1000000000000000"));
      
//       await deposit(investor3, depositAmount, offRamAmount);
//       console.log("tbill balance investor3: " + await vault.balanceOf(investor3.address));

//       // expect(await vault.totalSupply()).to.equal(expectedTBillRemaining);
//       // expect(await vault.balanceOf(investor1.address)).to.equal(expectedTBillInvestor1);
//       // // console.log(await vault._feeClaimable());
//       // // console.log(await vault._feeClaimable());
//       // await vault.connect(investor1).mint(ethers.utils.parseEther('100000'), investor1.address );
//     });

//     it("exchange rate", async function () {
//       await deposit(investor1, initBalanceInvestor, "0");
//       await deposit(investor2, initBalanceInvestor, "0");
//       await deposit(investor3, initBalanceInvestor, "0");

//       // transfer usdc to coinbase account
//       const totalVaultUSDC = Number(ethers.utils.formatEther(await usdc.balanceOf(vault.address)));
//       const ninetyPercentVault = totalVaultUSDC - (totalVaultUSDC * targetReservesLevel / 100); // 90% of total usdc on vault
//       // withdraw 90% usdc from vault to coinbase account
//       const offRamAmount = ninetyPercentVault.toString();
//       await vault.fundTBillPurchase(ethers.utils.parseEther(offRamAmount));
//       console.log("offRamAmount:"+ offRamAmount);
//       console.log("init onchainServiceFeeClaimable: " + await vault._onchainServiceFeeClaimable());
//       console.log("init offchainServiceFeeClaimable: " + await vault._offchainServiceFeeClaimable());

//       await processEpochUpdate(offRamAmount);

//       // await withdraw(investor1, (await vault.balanceOf(investor1.address)).add(1), offRamAmount);

//       await withdraw(investor1, initBalanceInvestor.div(2), offRamAmount);
//       console.log("usdc balance investor1: "+ await usdc.balanceOf(investor1.address));

//       await withdraw(investor2, initBalanceInvestor.div(3), offRamAmount);
//       console.log("usdc balance investor2: "+ await usdc.balanceOf(investor2.address));

//       await withdraw(investor3, initBalanceInvestor.div(4), offRamAmount);
//       console.log("usdc balance investor3: "+ await usdc.balanceOf(investor3.address));
//       console.log("before onchainServiceFeeClaimable: " + await vault._onchainServiceFeeClaimable());
//       console.log("before offchainServiceFeeClaimable: " + await vault._offchainServiceFeeClaimable());

//       const onRamAmount = (Number(ninetyPercentVault) - 2000000 + 5000).toString(); // remote 2M and add 5k
//       await usdc.transfer(vault.address, ethers.utils.parseEther("2000000")); // transfer 2M to vault
//       await processEpochUpdate(onRamAmount); // update epoch data
//       console.log("after onchainServiceFeeClaimable: " + await vault._onchainServiceFeeClaimable());
//       console.log("after offchainServiceFeeClaimable: " + await vault._offchainServiceFeeClaimable());

//       await processWithdrawalQueue(onRamAmount); // process withdraw queue
//       console.log("usdc balance investor2: "+ await usdc.balanceOf(investor2.address));
//       console.log("usdc balance investor1: "+ await usdc.balanceOf(investor1.address));
//       console.log("usdc balance investor3: "+ await usdc.balanceOf(investor3.address));
      
//       const oplServiceProviderBeforeClaim = await usdc.balanceOf(oplServiceProvider.address);
//       const onchainServiceFeeClaimable = await vault._onchainServiceFeeClaimable();
//       const offchainServiceFeeClaimable = await vault._offchainServiceFeeClaimable();

//       await vault.claimOnchainServiceFee(onchainServiceFeeClaimable);
//       await vault.claimOffchainServiceFee(offchainServiceFeeClaimable);
//       expect(await usdc.balanceOf(oplServiceProvider.address)).to.equal(onchainServiceFeeClaimable.add(oplServiceProviderBeforeClaim).add(offchainServiceFeeClaimable));

//     });

//     it("first deposit", async function () {
//       let firstDeposit = await vault._firstDeposit(investor1.address);
//       expect(firstDeposit).to.equal(false);
//       await deposit(investor1, initBalanceInvestor, "0");
//       firstDeposit = await vault._firstDeposit(investor1.address);
//       expect(firstDeposit).to.equal(true);
//     });

//     it("deposit less than first deposit", async function () {
//       let firstDeposit = await vault._firstDeposit(investor1.address);
//       expect(firstDeposit).to.equal(false);
//       expect(vault.connect(investor1).deposit(minDeposit, investor1.address)).to.revertedWith("TBILL: deposit less than minimum first Deposit");
//       await deposit(investor1, firstDepositAmount, "0");
//       expect(await vault._firstDeposit(investor1.address)).to.equal(true);
//       vault.connect(investor1).deposit(minDeposit, investor1.address);
//       expect(await vault._firstDeposit(investor1.address)).to.equal(true);
//     });

// });

// describe("After update decimal", function () {
//   let apiConsumer;
//   let mockOracle;
//   let owner, operator, coinbaseAccount, oplServiceProvider, investor1, investor2, investor3, investor4, investor5;;
//   let usdc, vault, linkToken;
//   const initBalanceInvestor = ethers.utils.parseEther('1000000'); // 10M
//   const depositAmount = "300000000"; // 10$
  
//   const withdrawAmount = ethers.utils.parseEther('50000');  // 50k
//   const amountShares = ethers.utils.parseEther('50000');  // 50k

//   const minDepositAmount = ethers.utils.parseEther('10000'); // 1M
//   const amountShare = ethers.utils.parseEther('999500');  // 100k
//   const amountRedeem = ethers.utils.parseEther('100000');  // 100k

//   const bpsUnit = 10000;  // 
//   const decimals = 6; //
//   const minDeposit = "10000000"; // 10$
//   const maxDeposit = ethers.utils.parseEther('1000000'); // 1M
//   const maxWithdraw = ethers.utils.parseEther('1000000'); // 1M
//   const firstDepositAmount = "10000000"; // 10$

//   const transactionFee = 5; // 5bps
//   // const transactionFeeWeekdayRate = 5; // 5bps
//   // const transactionFeeWeekendRate = 10; // 5bps
//   const targetReservesLevel = 10; // 10%
//   const onchainServiceFeeRate = 40; // 40bps
//   const offchainServiceFeeRate = 40; // 40bps
//   const minTxsFee = 25;// 25$

//     beforeEach(async function ()  {
//       [owner, investor1, investor2, investor3, investor4, investor5, operator, coinbaseAccount, oplServiceProvider] = await ethers.getSigners();

//       const USDC = await ethers.getContractFactory("USDC");
//       usdc = await USDC.deploy();
//       await usdc.deployed();
      
//       const chainId = "default";

//       const linkTokenFactory = await ethers.getContractFactory("LinkToken")
//       linkToken = await linkTokenFactory.deploy()
//       await linkToken.deployed();

//       const mockOracleFactory = await ethers.getContractFactory("MockOracle")
//       mockOracle = await mockOracleFactory.deploy(linkToken.address)
//       await mockOracle.deployed();


//       const chainlinkJobId = ethers.utils.toUtf8Bytes("29fa9aa13bf1468788b7cc4a500a1234")
//       const chainlinkFee = "100000000000000000"
      
//       // ==============
//       const apiConsumerFactory = await ethers.getContractFactory("APIConsumer")
//       apiConsumer = await apiConsumerFactory
//           .deploy(mockOracle.address, chainlinkJobId, chainlinkFee, linkToken.address)
      
//       await apiConsumer.deployed();
//       // ==============
//       const fundAmount = "10000000000000000000"
//       await linkToken.transfer(apiConsumer.address, fundAmount)

//       const vaultParameters = {
//         transactionFee: transactionFee, // 5 bps
//         // transactionFeeWeekdayRate: transactionFeeWeekdayRate, // 5 bps
//         // transactionFeeWeekendRate: transactionFeeWeekendRate, // 10 bps
//         firstDeposit: firstDepositAmount,
//         minDeposit: minDeposit, // 100000 USDC
//         maxDeposit: maxDeposit, // max deposit on a day
//         maxWithdraw: maxWithdraw, // max withdraw on a day
//         targetReservesLevel: targetReservesLevel, // 10%
//         onchainServiceFeeRate: onchainServiceFeeRate, // 40 bps
//         offchainServiceFeeRate: offchainServiceFeeRate, // 40 bps
//         decimals: decimals // 6
//       }

//       const chainlinkParameters = {
//           jobId: chainlinkJobId,
//           fee: chainlinkFee,
//           urlData: "https://openeden-node.vercel.app/vault/assets/offchain",
//           pathToOffchainAssets: "totalOffChainAssets",
//           pathToTotalOffchainAssetAtLastClose: "pathToTotalOffchainAssetAtLastClose"
//       }
//       // deploy vault contract
//       const Vault = await ethers.getContractFactory("OpenEdenVault");

//       vault = await Vault.deploy(
//         usdc.address,
//         operator.address,
//         oplServiceProvider.address,
//         coinbaseAccount.address,
//         vaultParameters,
//         chainlinkParameters,
//         linkToken.address,
//         mockOracle.address
//       );

//       await vault.deployed();

//       // transfer usdc to investor
//       await usdc.transfer(investor1.address, initBalanceInvestor);
//       await usdc.transfer(investor2.address, initBalanceInvestor);
//       await usdc.transfer(investor3.address, initBalanceInvestor);
//       await usdc.transfer(investor4.address, initBalanceInvestor);
//       await usdc.transfer(investor5.address, initBalanceInvestor);
//       await usdc.connect(investor1).approve(vault.address, initBalanceInvestor);
//       await usdc.connect(investor2).approve(vault.address, initBalanceInvestor);
//       await usdc.connect(investor3).approve(vault.address, initBalanceInvestor);
//       await usdc.connect(investor4).approve(vault.address, initBalanceInvestor);
//       await usdc.connect(investor5).approve(vault.address, initBalanceInvestor);
//       // whitelist investor
//       await vault.whitelistNonUsInvestor(investor1.address, true);
//       await vault.whitelistNonUsInvestor(investor2.address, true);
//       await vault.whitelistNonUsInvestor(investor3.address, true);
//       await vault.whitelistUsInvestor(investor4.address, true);
//       //await vault.whitelistUsInvestor(investor5.address, true);
//       // fund link
//       await linkToken.transfer(vault.address, fundAmount);
//       //await vault.connect(investor1).approve(vault.address, initBalanceInvestor);

//     });

//     async function deposit(invertor, depositAmount, totalOffChainAssets) {
//       const transaction = await vault.connect(invertor).deposit(depositAmount, invertor.address);
//       const transactionReceipt = await transaction.wait(1)
//       const requestId = transactionReceipt.events[0].topics[1]
//       // current off-chain assets
//       const callbackValue = ethers.utils.parseEther(totalOffChainAssets);
//       await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
//     }

//     async function withdraw(invertor, depositAmount, totalOffChainAssets) {
//       const transaction = await vault.connect(invertor).withdraw(depositAmount, invertor.address, invertor.address);
//       const transactionReceipt = await transaction.wait(1)
//       const requestId = transactionReceipt.events[0].topics[1]
//       // current off-chain assets
//       const callbackValue = ethers.utils.parseEther(totalOffChainAssets);
//       await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
//     }

//     async function processEpochUpdate(totalOffChainAssets) {
//       // pause
//       const transaction = await vault.requestUpdateEpoch();
//       // unpause
//       const transactionReceipt = await transaction.wait(1)
//       const requestId = transactionReceipt.events[0].topics[1]
//       // current off-chain assets
//       const callbackValue = ethers.utils.parseEther(totalOffChainAssets);
//       await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
//     }

//     async function processWithdrawalQueue(totalOffChainAssets) {
//       const transaction = await vault.processWithdrawalQueue();
//       const transactionReceipt = await transaction.wait(1)
//       const requestId = transactionReceipt.events[0].topics[1]
//       // current off-chain assets
//       const callbackValue = ethers.utils.parseEther(totalOffChainAssets);
//       await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
//     }
    
//     it("Deposit USDC", async function () {
      
//       await deposit(investor1, depositAmount, "0");
//       await deposit(investor2, depositAmount, "0");

//       // check txs fee of oplServiceProvider account
//       let txsFeeAmount = "25000000";
//       console.log("tbill balance investor1: " + await vault.balanceOf(investor1.address));
//       console.log("usdc balance investor1: " + await usdc.balanceOf(investor1.address));
//       let exchangeRateDecimal = await vault._exchangeRateDecimal();
//       console.log("exchangeRateDecimal: " + exchangeRateDecimal);
//       let result = await vault._vaultParameters();
//       console.log("vault.decimals: " + result.decimals);
//      // await withdraw(investor1, "5000000", "0");
//       console.log("tbill balance investor1 after withdraw: " + await vault.balanceOf(investor1.address));
//       console.log("usdc balance investor1 after withdraw: " + await usdc.balanceOf(investor1.address));
//       const amountTransfer = "100000000";
//       await vault.connect(investor1).transfer(investor2.address, amountTransfer);
//       await vault.connect(investor2).transfer(investor5.address, amountTransfer);

//       console.log("tbill balance investor1 after withdraw: " + await vault.balanceOf(investor1.address));
//       await vault.connect(investor1).approve(investor2.address, "10000000000");
//       await vault.bansInvestor(investor1.address, true, true);
//       await vault.bansInvestor(investor1.address, false, true);

//       await vault.connect(investor2).transferFrom(investor1.address, investor3.address,"20000000");
//       console.log("tbill balance investor1 after withdraw: " + await vault.balanceOf(investor1.address));

//       await vault.connect(investor2).transferFrom(investor1.address, investor4.address,"20000000");
//       await vault.connect(investor2).transferFrom(investor1.address, investor5.address,"20000000");
//       await vault.whitelistUsInvestor(investor5.address, true);
//       await vault.connect(investor4).transfer(investor5.address,"20000000");
//       await vault.whitelistUsInvestor(investor5.address, false);
//       expect(vault.connect(investor4).transfer(investor5.address,"20000000")).to.revertedWith("US investor cannot transfer to account not whitelist");

//       //await vault.bansInvestor(investor1.address, false);
//     });

//     it("Update txs fee", async function () {
//       const newTxsFee = 10;
//       let result = await vault._vaultParameters();
//       expect(result.transactionFee).to.equal(transactionFee);
//       vault.pause();
//       await vault.setTransactionFee(newTxsFee);
//       result = await vault._vaultParameters();
//       expect(result.transactionFee).to.equal(newTxsFee);
//     });

//     // it("Update fee rate weekend", async function () {
//     //   const newFeeRate = 15;
//     //   let result = await vault._vaultParameters();
//     //   expect(result.transactionFeeWeekendRate).to.equal(transactionFeeWeekendRate);
//     //   vault.pause();
//     //   await vault.setTransactionFeeWeekendRate(newFeeRate);
//     //   result = await vault._vaultParameters();
//     //   expect(result.transactionFeeWeekendRate).to.equal(newFeeRate);
//     // });

//     it("Update fee rate weekday", async function () {
//       const newFeeRate = 20;
//       let result = await vault._vaultParameters();
//       expect(result.transactionFee).to.equal(transactionFee);
//       vault.pause();
//       await vault.setTransactionFee(newFeeRate);
//       result = await vault._vaultParameters();
//       expect(result.transactionFee).to.equal(newFeeRate);
//     });

//     it("Update first deposit amount", async function () {
//       const newFirstDepositAmount = 50;
//       let result = await vault._vaultParameters();
//       expect(result.firstDeposit).to.equal(firstDepositAmount);
//       vault.pause();
//       await vault.setFirstDeposit(newFirstDepositAmount);
//       result = await vault._vaultParameters();
//       expect(result.firstDeposit).to.equal(newFirstDepositAmount);
//     });

//     it("Update min deposit", async function () {
//       const newMinDeposit = 50;
//       let result = await vault._vaultParameters();
//       expect(result.minDeposit).to.equal(minDeposit);
//       vault.pause();
//       await vault.setMinDeposit(newMinDeposit);
//       result = await vault._vaultParameters();
//       expect(result.minDeposit).to.equal(newMinDeposit);
//     });

//     it("Update max deposit", async function () {
//       const newMaxDeposit = 50;
//       let result = await vault._vaultParameters();
//       expect(result.maxDeposit).to.equal(maxDeposit);
//       vault.pause();
//       await vault.setMaxDeposit(newMaxDeposit);
//       result = await vault._vaultParameters();
//       expect(result.maxDeposit).to.equal(newMaxDeposit);
//     });

//     it("Update max withdraw", async function () {
//       const newMaxWithdraw = 50;
//       let result = await vault._vaultParameters();
//       expect(result.maxWithdraw).to.equal(maxWithdraw);
//       vault.pause();
//       await vault.setMaxWithdraw(newMaxWithdraw);
//       result = await vault._vaultParameters();
//       expect(result.maxWithdraw).to.equal(newMaxWithdraw);
//     });

//     it("Update target reserves level", async function () {
//       const newTargetReservesLevel = 50;
//       let result = await vault._vaultParameters();
//       expect(result.targetReservesLevel).to.equal(targetReservesLevel);
//       vault.pause();
//       await vault.setTargetReservesLevel(newTargetReservesLevel);
//       result = await vault._vaultParameters();
//       expect(result.targetReservesLevel).to.equal(newTargetReservesLevel);
//     });

//     it("Update offchain management fee rate", async function () {
//       const newOffchainServiceFeeRate= 50;
//       let result = await vault._vaultParameters();
//       expect(result.offchainServiceFeeRate).to.equal(offchainServiceFeeRate);
//       vault.pause();
//       await vault.setOffchainServiceFeeRate(newOffchainServiceFeeRate);
//       result = await vault._vaultParameters();
//       expect(result.offchainServiceFeeRate).to.equal(newOffchainServiceFeeRate);
//     });

//     it("Update decimal", async function () {
//       const newDecimals= 18;
//       let result = await vault._vaultParameters();
//       expect(result.decimals).to.equal(decimals);
//       vault.pause();
//       await vault.setDecimals(newDecimals);
//       result = await vault._vaultParameters();
//       expect(result.decimals).to.equal(newDecimals);
//     });

//     // decimals: decimals // 6
// });


