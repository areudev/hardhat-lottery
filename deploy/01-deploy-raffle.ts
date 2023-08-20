import {Addressable} from 'ethers'
import {ethers} from 'hardhat'
import {DeployFunction} from 'hardhat-deploy/types'
import {HardhatRuntimeEnvironment} from 'hardhat/types'
import {networkConfig} from '../helper-hardhat-config'
import {VRFCoordinatorV2Mock} from '../typechain-types'

const FUND_AMOUNT = ethers.parseEther('1').toString()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log('Deploying FundMe contract...')
  const {deployments, getNamedAccounts, network} = hre
  const {deploy, log} = deployments
  const {deployer} = await getNamedAccounts()
  const chainId = network.config.chainId || 31337
  let vrfCoordinatorV2Address: string | undefined | Addressable,
    subscriptionId: string | undefined

  if (chainId === 31337) {
    const vrfCoordinatorV2Mock: VRFCoordinatorV2Mock = await ethers.getContract(
      'VRFCoordinatorV2Mock',
    )
    // const vrfCoordinatorV2Mock = await deployments.get('VRFCoordinatorV2Mock')
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
    const transactionReceipt = (await transactionResponse.wait(1)) as any

    log('VRFCoordinatorV2Mock.createSubscription() transactionReceipt:', {
      transactionReceipt,
    })

    subscriptionId = transactionReceipt.events[0].args.subId as string
    // fund subscription
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
  } else {
    if (!networkConfig[chainId].vrfCoordinatorV2) {
      throw new Error('No vrfCoordinatorV2 address set for network')
    }
    vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
    subscriptionId = networkConfig[chainId].subscriptionId
  }
  const entranceFee = networkConfig[chainId].raffleEntranceFee
  const gasLane = networkConfig[chainId].gasLane
  const callbackGasLimit = networkConfig[chainId].callbackGasLimit
  const interval = networkConfig[chainId].keepersUpdateInterval
  const args = [
    vrfCoordinatorV2Address,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ]
  const raffle = await deploy('Raffle', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: 1,
  })
}
