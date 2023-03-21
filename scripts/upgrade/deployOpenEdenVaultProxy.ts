const { ethers, upgrades } = require("hardhat");
import { getBaseVault, getKycManager } from '../../helpers/contracts-getters';
import { deployOpenEdenVaultProxy } from '../../helpers/contracts-deployments';
import hre from 'hardhat'
import { BigNumber } from 'ethers';
// const Web3 = require('web3');
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');
import { setDRE } from '../../helpers/misc-utils';

async function main() {
  setDRE(hre)

  /*//////////////////////////////////////////////////////////////
                  Parse Parameters from .env
  //////////////////////////////////////////////////////////////*/

  const usdcAddr = process.env.USDC_ADDRESS
  const operatorAddr = process.env.OPERATOR_ADDRESS
  const oplAddr = process.env.OPL_SERVICE_PROVIDER_ADDRESS
  const treasuryAddr = process.env.TREASURE_ACCOUNT
  const chainlinkTokenAddr = process.env.CHAINLINK_TOKEN_ADDRESS
  const chainLinkOracleAddr = process.env.CHAINLINK_ORACLE_ADDRESS

  const jobId = web3.utils.asciiToHex(process.env.CHAINLINK_JOBID)
  const chainlinkParameters = {
    jobId: jobId,
    fee: BigNumber.from(process.env.CHAINLINK_FEE),
    urlData: process.env.CHAINLINK_URL_DATA,
    pathToOffchainAssets: process.env.CHAINLINK_PATH_TO_OFFCHAIN_ASSETS,
    pathToTotalOffchainAssetAtLastClose: process.env.CHAINLINK_PATH_TO_OFFCHAIN_ASSETS_AT_LAST_CLOSE
  }

  const baseVault = await getBaseVault()
  console.log('baseVault:', baseVault.address);

  const kycManager = await getKycManager()
  console.log('kycManager:', kycManager.address);

  const openEdenVaultProxy = await deployOpenEdenVaultProxy(
    '', // place holder
    false,
    usdcAddr,
    operatorAddr,
    oplAddr,
    treasuryAddr,
    baseVault.address,
    kycManager.address,
    chainlinkTokenAddr,
    chainLinkOracleAddr,
    chainlinkParameters
  )

  console.log("openEdenVaultProxy address:", openEdenVaultProxy.address);
}

main();