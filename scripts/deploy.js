const hre = require("hardhat");
require('dotenv').config();
const { ethers } = require("ethers");
const Web3 = require('web3');
const web3 = new Web3('https://eth-goerli.g.alchemy.com/v2/hde_6enjYkmgq4K6PJ1x8gcb7vBnIjWb');
const ethjsAbi = require('ethjs-abi');


async function main() {
  //deploy vault contract
  const vaultParameters = {
    transactionFee: process.env.TRANSACTION_FEE_WEEKDAY, // 5 bps
    transactionFeeWeekdayRate: process.env.TRANSACTION_FEE_WEEKEND, // 5 bps
    transactionFeeWeekendRate: process.env.TRANSACTION_FEE_WEEKEND, // 10 bps
    firstDeposit: process.env.FIRST_DEPOSIT,
    minDeposit: process.env.MIN_DEPOSIT, // 10000 USDC
    maxDeposit: process.env.MAX_DEPOSIT, // max deposit on a day
    maxWithdraw: process.env.MAX_WITHDRAW, // max withdraw on a day
    targetReservesLevel: process.env.TARGET_RESERVE_LEVEL, // 10%
    managementFeeRate: process.env.MANAGEMENT_FEE_RATE, // 40 bps
    decimals: process.env.DECIMALS
  }

  //let encodedBytes32 = web3.eth.abi.encodeParameter('bytes32', process.env.CHAINLINK_JOBID);
  //let bytes32Value = ethjsAbi.rawEncode(['bytes32'], [process.env.CHAINLINK_JOBID]);
  const jobId = web3.utils.asciiToHex(process.env.CHAINLINK_JOBID)
  console.log("jobId: " + jobId);

  const chainlinkParameters = {
    jobId: jobId,
    fee: process.env.CHAINLINK_FEE,
    urlData: process.env.CHAINLINK_URL_DATA,
    pathToOffchainAssets: process.env.CHAINLINK_PATH_TO_OFFCHAIN_ASSETS
  }

  const Vault = await hre.ethers.getContractFactory("OpenEdenVault");
  const vault = await Vault.deploy(
    process.env.USDC_ADDRESS,
    process.env.OPERATOR_ADDRESS,
    process.env.FEE_TO_ADDRESS,
    process.env.COINBASE_ACCOUNT,
    vaultParameters,
    chainlinkParameters,
    process.env.CHAINLINK_TOKEN_ADDRESS ,
    process.env.CHAINLINK_ORACLE_ADDRESS 
  );
  await vault.deployed();
  console.log(`vault contract deployed to: ${vault.address}`);

}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
