// const hre = require("hardhat");
// require('dotenv').config();
// const { ethers } = require("ethers");
// const Web3 = require('web3');
// const web3 = new Web3('https://eth-goerli.g.alchemy.com/v2/hde_6enjYkmgq4K6PJ1x8gcb7vBnIjWb');
// const ethjsAbi = require('ethjs-abi');

const { ethers, upgrades } = require("hardhat");

async function main() {
  // build vault Parameters
  const vaultParameters = {
    transactionFee: process.env.TRANSACTION_FEE, // 5 bps
    firstDeposit: process.env.FIRST_DEPOSIT, // 100K USDC
    minDeposit: process.env.MIN_DEPOSIT, // 10K USDC
    maxDeposit: process.env.MAX_DEPOSIT, // max deposit on a day
    maxWithdraw: process.env.MAX_WITHDRAW, // max withdraw on a day
    targetReservesLevel: process.env.TARGET_RESERVE_LEVEL, // 10%
    onchainServiceFeeRate: process.env.ONCHAIN_SERVICE_FEE_RATE, // 40 bps
    offchainServiceFeeRate: process.env.OFFCHAIN_SERVICE_FEE_RATE, // 40 bps
  }
  // deploy base vault sc
  const BaseVault = await hre.ethers.getContractFactory("BaseVault");
  const baseVault = await BaseVault.deploy(vaultParameters);
  await baseVault.deployed();
  console.log(`baseVault contract deployed to: ${baseVault.address}`);

  // deploy whitelist Manager sc
  const KycManager = await hre.ethers.getContractFactory("KycManager");
  const kycManager = await KycManager.deploy();
  await kycManager.deployed();
  console.log(`kycManager contract deployed to: ${kycManager.address}`);


  // build chainlink Parameters 
  const jobId = web3.utils.asciiToHex(process.env.CHAINLINK_JOBID)
  console.log("jobId: " + jobId);
  const chainlinkParameters = {
    jobId: jobId,
    fee: process.env.CHAINLINK_FEE,
    urlData: process.env.CHAINLINK_URL_DATA,
    pathToOffchainAssets: process.env.CHAINLINK_PATH_TO_OFFCHAIN_ASSETS,
    pathToTotalOffchainAssetAtLastClose: process.env.CHAINLINK_PATH_TO_OFFCHAIN_ASSETS_AT_LAST_CLOSE
  }
  // deploy vault
  const Vault = await hre.ethers.getContractFactory("OpenEdenVault");
  const vault = await Vault.deploy();
  await vault.deployed();
  console.log(`vault contract deployed to: ${vault.address}`);

  await vault.initialize(
    process.env.USDC_ADDRESS,
    process.env.OPERATOR_ADDRESS,
    process.env.OPL_SERVICE_PROVIDER_ADDRESS,
    process.env.TREASURE_ACCOUNT,
    baseVault.address,
    kycManager.address,
    process.env.CHAINLINK_TOKEN_ADDRESS,
    process.env.CHAINLINK_ORACLE_ADDRESS,
    chainlinkParameters
  );
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
