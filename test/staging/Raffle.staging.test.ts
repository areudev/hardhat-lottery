// import {  } from "@nomiclabs/hardhat-ethers/signers"
import {assert, expect} from 'chai'
import {BigNumberish} from 'ethers'
import {network, deployments, ethers} from 'hardhat'
import {developmentChains, networkConfig} from '../../helper-hardhat-config'
import {Raffle, VRFCoordinatorV2Mock} from '../../typechain-types'
import {SignerWithAddress} from '@nomicfoundation/hardhat-ethers/signers'
import {mine, time} from '@nomicfoundation/hardhat-toolbox/network-helpers'

const chainId = network.config.chainId || 31337

if (developmentChains.includes(network.name)) {
  describe.skip
} else {
  describe('Raffle Staging Tests', () => {
    let raffle: Raffle
    let raffleEntranceFee: bigint
    let deployer: SignerWithAddress
    let accounts: SignerWithAddress[]

    beforeEach(async () => {
      // const {deployer} = await ethers.getNamedSigners()
      accounts = await ethers.getSigners()
      raffle = await ethers.getContract('Raffle')
      raffleEntranceFee = await raffle.getEntranceFee()
    })
    describe('fulfillRandomWords', () => {
      it('works with live chainlink keepers and chainlink vrf, we get a random winner', async () => {
        const startingTimestamp = await raffle.getLastTimeStamp()
        await new Promise<void>(async (resolve, reject) => {
          ;(raffle as any).once('WinnerPicked', async () => {
            console.log('WinnerPicked event fired')
            resolve()
            try {
              // asserts here
              const recentWinner = await raffle.getRecentWinner()
              const raffleState = await raffle.getRaffleState()
              // const winnerBalance = await accounts[0].getBalance()
              // await ethers.provider.getBalance(recentWinner)
              console.log('recentWinner', recentWinner)
              console.log('deployer', accounts[0].address)
              const winnerEndingBalance = await ethers.provider.getBalance(
                accounts[0].address,
              )
              const endingTimestamp = await raffle.getLastTimeStamp()
              const numPlayers = await raffle.getNumberOfPlayers()
              assert.equal(raffleState.toString(), '0')
              assert.equal(numPlayers.toString(), '0')
              assert.equal(recentWinner, accounts[0].address)
              assert.equal(
                winnerEndingBalance.toString(),
                (winnerStartingBalance + raffleEntranceFee).toString(),
              )
              assert(endingTimestamp > startingTimestamp)
            } catch (e) {
              reject(e)
            }
          })
          // entering the raffle
          await raffle.enterRaffle({value: raffleEntranceFee})
          const winnerStartingBalance = await ethers.provider.getBalance(
            accounts[0].address,
          )
        })
      })
    })
  })
}
