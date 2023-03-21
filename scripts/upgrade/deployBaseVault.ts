const { ethers, upgrades } = require("hardhat");
import hre from 'hardhat'
import { deployBaseVault } from "../../helpers/contracts-deployments";
import { BigNumber } from 'ethers';
import { setDRE } from '../../helpers/misc-utils';

async function main() {
  setDRE(hre)

  /*//////////////////////////////////////////////////////////////
                  Parse Parameters from .env
  //////////////////////////////////////////////////////////////*/

  const transactionFee = BigNumber.from(process.env.TRANSACTION_FEE)
  const firstDeposit = BigNumber.from(process.env.FIRST_DEPOSIT)
  const minDeposit = BigNumber.from(process.env.MIN_DEPOSIT)
  const maxDeposit = BigNumber.from(process.env.MAX_DEPOSIT)
  const maxWithdraw = BigNumber.from(process.env.MAX_WITHDRAW)
  const targetReservesLevel = BigNumber.from(process.env.TARGET_RESERVE_LEVEL)
  const onchainServiceFeeRate = BigNumber.from(process.env.ONCHAIN_SERVICE_FEE_RATE)
  const offchainServiceFeeRate = BigNumber.from(process.env.OFFCHAIN_SERVICE_FEE_RATE)


  const baseVault = await deployBaseVault(
    transactionFee,
    firstDeposit,
    minDeposit,
    maxDeposit,
    maxWithdraw,
    targetReservesLevel,
    onchainServiceFeeRate,
    offchainServiceFeeRate, false)

  console.log("baseVault address:", baseVault.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});