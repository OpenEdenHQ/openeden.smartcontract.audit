require("@nomicfoundation/hardhat-toolbox");
const fs = require("fs");
const privateKey = fs.readFileSync(".secret").toString();
/** @type import('hardhat/config').HardhatUserConfig */

module.exports = {
  networks: {
    hardhat: {
      chainId: 1337
    },
    goerli: {
      url:  'https://eth-goerli.g.alchemy.com/v2/',
      chainId: 5,
      accounts: [privateKey]
    },
    eth_mainnet: {
      url:  'https://eth-mainnet.g.alchemy.com/v2/',
      chainId: 1,
      accounts: [privateKey]
    }
  },
  solidity:{
    // settings: {
    //   optimizer: {
    //     enabled: true,
    //     runs: 10000,
    //   },
    // },
    compilers: [
      {
          version: "0.8.17",
          settings: {
            optimizer: {
              enabled: true,
              runs: 200
            },
          }
      },
      {
          version: "0.6.6",
          settings: {
            optimizer: {
              enabled: true,
              runs: 200
            },
          }
      },
      {
          version: "0.4.24",
          settings: {
            optimizer: {
              enabled: true,
              runs: 200
            },
          }
      },
    ],
    // paths: {
    //   sources: "./contracts",
    //   tests: "./test",
    //   cache: "./build/cache",
    //   artifacts: "./build/artifacts",
    // },
  } 
};
