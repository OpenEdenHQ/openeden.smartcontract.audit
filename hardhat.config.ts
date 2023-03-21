import path from 'path'
import fs from 'fs'
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import 'hardhat-storage-layout'
import 'hardhat-contract-sizer'
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();
import TestWallets from "./test-wallets";

// 0xC4109e427A149239e6C1E35Bb2eCD0015B6500B8
const privateKey = fs.readFileSync(".secret").toString();

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      chainId: 1337
    },
    goerli: {
      url: 'https://eth-goerli.g.alchemy.com/v2/hde_6enjYkmgq4K6PJ1x8gcb7vBnIjWb',
      chainId: 5,
      accounts: [privateKey]
    },
    eth_mainnet: {
      url: 'https://eth-mainnet.g.alchemy.com/v2/_-yH7SQdgqH3irRvJIFR9WwCcqViWbXP',
      chainId: 1,
      accounts: [privateKey]
    }
  },
  solidity: {
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
        version: "0.7.6",
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

export default config;