const { ethers, upgrades } = require("hardhat");

async function main() {
  // TODO
  const proxyAddress = ''

  const OpenEdenVaultV2 = await ethers.getContractFactory("OpenEdenVaultV2");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, OpenEdenVaultV2);
  upgrades.deployProxy()
  console.log("OpenEdenVaultV2 address:", upgraded.address);
}

main();