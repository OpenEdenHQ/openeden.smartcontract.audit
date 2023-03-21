const { ethers, upgrades } = require("hardhat");
import hre from 'hardhat'
import { deployKycManager } from "../../helpers/contracts-deployments";
import { setDRE } from '../../helpers/misc-utils';

async function main() {
  setDRE(hre)

  const kycManager = await deployKycManager()
  console.log("kycManager address:", kycManager.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});