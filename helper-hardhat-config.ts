import {ethers} from 'hardhat'

export type networkConfigItem = {
  name?: string
  subscriptionId?: string
  gasLane?: string
  keepersUpdateInterval?: string
  raffleEntranceFee?: string
  callbackGasLimit?: string
  vrfCoordinatorV2?: string
}

export type networkConfigInfo = {
  [key: number]: networkConfigItem
}

export const networkConfig: networkConfigInfo = {
  31337: {
    name: 'localhost',
    subscriptionId: '588',
    gasLane:
      '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c', // 30 gwei
    keepersUpdateInterval: '30',
    raffleEntranceFee: ethers.parseEther('0.01').toString(),
    callbackGasLimit: '500000',
  },
  11155111: {
    name: 'sepolia',
    subscriptionId: '4625',
    gasLane:
      '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c', // 30 gwei
    keepersUpdateInterval: '30',
    raffleEntranceFee: ethers.parseEther('0.01').toString(),
    callbackGasLimit: '500000',
    vrfCoordinatorV2: '0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625',
  },
  1: {
    name: 'mainnet',
    keepersUpdateInterval: '30',
  },
}

export const developmentChains = ['hardhat', 'localhost']
