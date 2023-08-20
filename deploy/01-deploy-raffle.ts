import {Addressable} from 'ethers'
import {ethers} from 'hardhat'
import {DeployFunction} from 'hardhat-deploy/types'
import {HardhatRuntimeEnvironment} from 'hardhat/types'
import {developmentChains, networkConfig} from '../helper-hardhat-config'
import {VRFCoordinatorV2Mock} from '../typechain-types'
import verify from '../utils/verify'

const FUND_AMOUNT = ethers.parseEther('1')

const deployRaffle: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  console.log('Deploying Raffle contract...')
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

    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target

    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
    const transactionReceipt = await transactionResponse.wait(1)
    const filter = vrfCoordinatorV2Mock.filters.SubscriptionCreated()

    if (!transactionReceipt) {
      throw new Error('No transaction receipt')
    }
    const logs = await vrfCoordinatorV2Mock.queryFilter(
      filter,
      transactionReceipt.blockHash,
    )
    if (!logs || logs.length === 0) {
      throw new Error('No logs found')
    }
    const event = logs[0]

    const args = event.args

    subscriptionId = args[0].toString()

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

  console.log('Deployment args:', args)
  const raffle = await deploy('Raffle', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: 1,
  })

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log('Verifying...')
    await verify(raffle.address, args)
  }
}

export default deployRaffle
deployRaffle.tags = ['all', 'raffle']
