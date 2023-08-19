import {DeployFunction} from 'hardhat-deploy/types'
import {HardhatRuntimeEnvironment} from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log('Deploying FundMe contract...')
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const {deployer} = await getNamedAccounts()

  const raffle = await deploy('Raffle', {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  })
}
