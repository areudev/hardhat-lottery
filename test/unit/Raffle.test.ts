// import {  } from "@nomiclabs/hardhat-ethers/signers"
import {assert, expect} from 'chai'
import {BigNumberish} from 'ethers'
import {network, deployments, ethers} from 'hardhat'
import {developmentChains, networkConfig} from '../../helper-hardhat-config'
import {Raffle, VRFCoordinatorV2Mock} from '../../typechain-types'
import {SignerWithAddress} from '@nomicfoundation/hardhat-ethers/signers'
import {mine, time} from '@nomicfoundation/hardhat-toolbox/network-helpers'

const chainId = network.config.chainId || 31337

if (!developmentChains.includes(network.name)) {
  describe.skip
} else {
  describe('Raffle', () => {
    let raffle: Raffle
    let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock
    let raffleContract: Raffle
    let deployer: SignerWithAddress
    let player: SignerWithAddress
    let entranceFee: bigint
    let interval: bigint
    let accounts: SignerWithAddress[]

    beforeEach(async () => {
      // const {deployer} = await ethers.getNamedSigners()
      accounts = await ethers.getSigners()
      ;[deployer, player] = accounts
      await deployments.fixture(['mocks', 'raffle'])
      vrfCoordinatorV2Mock = await ethers.getContract(
        'VRFCoordinatorV2Mock',
        deployer,
      )
      raffleContract = await ethers.getContract('Raffle')
      // raffle = await ethers.getContract('Raffle', deployer)
      raffle = raffleContract.connect(player)
      entranceFee = await raffle.getEntranceFee()
      interval = await raffle.getInterval()
    })

    describe('constructor', () => {
      it('initialiazes the raffle contract correctly', async () => {
        const raffleState = await raffle.getRaffleState()

        assert.equal(raffleState.toString(), '0')
        assert.equal(
          interval.toString(),
          networkConfig[chainId].keepersUpdateInterval,
        )
        assert.equal(
          entranceFee.toString(),
          networkConfig[chainId].raffleEntranceFee,
        )
      })
    })
    describe('enterRaffle', () => {
      it('reverts when you dont pay enough', async () => {
        await expect(
          raffle.enterRaffle({
            value: ethers.parseEther('0.000000000000000001'),
          }),
        ).to.be.revertedWith('Not enough value sent')
      })
      it('records the player', async () => {
        await raffle.enterRaffle({
          value: entranceFee,
        })
        const playerFromContract = await raffle.getPlayer(0)
        assert.equal(playerFromContract, player.address)
      })
      it('emmits event on enter', async () => {
        await expect(raffle.enterRaffle({value: entranceFee})).to.emit(
          raffle,
          'RaffleEnter',
        )
      })
      it('doesnt allow entrance when raffle is calculating', async () => {
        await raffle.enterRaffle({value: entranceFee})
        await time.increase(ethers.toNumber(interval) + 1)
        // await time.increase(30 + 1)
        // await mine(10)

        // await raffle.performUpkeep('')
        await raffle.performUpkeep(ethers.encodeBytes32String('test'))
        await expect(
          raffle.enterRaffle({value: entranceFee}),
        ).to.be.revertedWith('Raffle is not open')
      })
    })
    describe('checkUpkeep', () => {
      it('returns false if people havent sent any ETH', async () => {
        // await raffle.enterRaffle({value: entranceFee})
        await time.increase(ethers.toNumber(interval) + 1)
        mine(10)

        const {upkeepNeeded} = await raffle.checkUpkeep.staticCall('0x')
        assert(!upkeepNeeded)
      })
      it('returns false if raffle isnt open', async () => {
        await raffle.enterRaffle({value: entranceFee})
        await time.increase(ethers.toNumber(interval) + 1)

        await raffle.performUpkeep('0x')
        const {upkeepNeeded} = await raffle.checkUpkeep.staticCall('0x')
        assert.equal(upkeepNeeded, false)
        const raffleState = await raffle.getRaffleState()
        assert.equal(raffleState.toString(), '1')
      })
    })

    describe('performUpkeep', () => {
      it('can only run if checkupkeep is true', async () => {
        await raffle.enterRaffle({value: entranceFee})
        await time.increase(ethers.toNumber(interval) + 1)
        const tx = await raffle.performUpkeep('0x')
        assert(tx)
      })
      it('reverts if checkupkeep is false', async () => {
        // await raffle.performUpkeep(ethers.encodeBytes32String('test'))
        await expect(
          raffle.performUpkeep(ethers.encodeBytes32String('test')),
        ).to.be.revertedWith('Upkeep not needed')
      })
      it('updates the raffle state and emits a requestId', async () => {
        await raffle.enterRaffle({value: entranceFee})
        await time.increase(ethers.toNumber(interval) + 1)
        const tx = await raffle.performUpkeep('0x')
        const txReceipt = await tx.wait(1)
        if (!txReceipt) {
          throw new Error('No transaction receipt')
        }
        const logs = await raffle.queryFilter(
          raffle.filters.RequestedRaffleWinner(),
          txReceipt.blockHash,
        )
        const requestId = logs[0].args?.requestId
        // console.log('logs', logs)
        // console.log('requestId', requestId)
        const raffleState = await raffle.getRaffleState()
        assert.equal(raffleState.toString(), '1')
        assert(ethers.toNumber(requestId) > 0)
        // console.log('txReceipt', txReceipt?.logs[0])
        // console.log('raffleState', raffleState.toString())
      })
    })
    describe('fulfillRandomWords', () => {
      beforeEach(async () => {
        await raffle.enterRaffle({value: entranceFee})
        await time.increase(ethers.toNumber(interval) + 1)
      })
      it('can only be called after performupkeep', async () => {
        await expect(
          vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target),
        ).to.be.revertedWith('nonexistent request')
        await expect(
          vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target),
        ).to.be.revertedWith('nonexistent request')
      })
      it('picks a winner, resets, and sends money', async () => {
        const additionalEntrances = 3
        const startingIndex = 2
        for (
          let i = startingIndex;
          i < startingIndex + additionalEntrances;
          i++
        ) {
          // console.log('account', i, accounts[i].address)
          raffle = raffle.connect(accounts[i])
          await raffle.enterRaffle({value: entranceFee})
          // raffle = raffleContract.connect(accounts[i])
        }

        const startingTimestamp = await raffle.getLastTimeStamp()

        await new Promise<void>(async (resolve, reject) => {
          ;(raffle as any).once('WinnerPicked', async () => {
            console.log('WinnerPicked')

            try {
              const recentWinner = await raffle.getRecentWinner()
              const raffleState = await raffle.getRaffleState()
              const lastTimeStamp = await raffle.getLastTimeStamp()
              const numPlayers = await raffle.getNumberOfPlayers()
              const winnerBalanceEnd = await ethers.provider.getBalance(
                accounts[startingIndex].address,
              )

              assert.equal(numPlayers.toString(), '0')
              assert.equal(raffleState.toString(), '0')
              assert(lastTimeStamp > startingTimestamp)
              assert.equal(recentWinner, accounts[startingIndex].address)
              assert(
                winnerBalanceEnd.toString(),
                (
                  winnerBalanceStart +
                  entranceFee * BigInt(additionalEntrances.toString())
                ).toString(),
              )
            } catch (e) {
              reject(e)
            }
            resolve()
          })
          const tx = await raffle.performUpkeep('0x')
          const txReceipt = await tx.wait(1)
          const winnerBalanceStart = await ethers.provider.getBalance(
            accounts[startingIndex].address,
          )
          console.log('starting balance', winnerBalanceStart.toString())
          if (!txReceipt) {
            throw new Error('No transaction receipt')
          }
          const logs = await raffle.queryFilter(
            raffle.filters.RequestedRaffleWinner(),
            txReceipt.blockHash,
          )
          const requestId = logs[0].args?.requestId

          await vrfCoordinatorV2Mock.fulfillRandomWords(
            requestId,
            raffle.target,
          )
        })
      })
    })
  })
}
