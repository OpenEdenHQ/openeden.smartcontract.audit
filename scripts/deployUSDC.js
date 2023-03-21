const hre = require("hardhat");
require('dotenv').config();
const Web3 = require('web3');

async function main() {
  const USDC = await hre.ethers.getContractFactory("USDC");
  const usdc = await USDC.deploy();
  await usdc.deployed();
  console.log(`usdc contract deployed to: ${usdc.address}`);
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
