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
    let deployer: SignerWithAddress
    let player: SignerWithAddress
    let entranceFee: BigNumberish
    let interval: BigNumberish

    beforeEach(async () => {
      // const {deployer} = await ethers.getNamedSigners()
      const accounts = await ethers.getSigners()
      ;[deployer, player] = accounts
      await deployments.fixture(['mocks', 'raffle'])
      vrfCoordinatorV2Mock = await ethers.getContract(
        'VRFCoordinatorV2Mock',
        deployer,
      )
      raffle = await ethers.getContract('Raffle', deployer)
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
        assert.equal(playerFromContract, deployer.address)
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
  })
}

// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
// import { expect } from "chai";
// import { ethers } from "hardhat";

// describe("Lock", function () {
//   // We define a fixture to reuse the same setup in every test.
//   // We use loadFixture to run this setup once, snapshot that state,
//   // and reset Hardhat Network to that snapshot in every test.
//   async function deployOneYearLockFixture() {
//     const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
//     const ONE_GWEI = 1_000_000_000;

//     const lockedAmount = ONE_GWEI;
//     const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

//     // Contracts are deployed using the first signer/account by default
//     const [owner, otherAccount] = await ethers.getSigners();

//     const Lock = await ethers.getContractFactory("Lock");
//     const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

//     return { lock, unlockTime, lockedAmount, owner, otherAccount };
//   }

//   describe("Deployment", function () {
//     it("Should set the right unlockTime", async function () {
//       const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

//       expect(await lock.unlockTime()).to.equal(unlockTime);
//     });

//     it("Should set the right owner", async function () {
//       const { lock, owner } = await loadFixture(deployOneYearLockFixture);

//       expect(await lock.owner()).to.equal(owner.address);
//     });

//     it("Should receive and store the funds to lock", async function () {
//       const { lock, lockedAmount } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       expect(await ethers.provider.getBalance(lock.target)).to.equal(
//         lockedAmount
//       );
//     });

//     it("Should fail if the unlockTime is not in the future", async function () {
//       // We don't use the fixture here because we want a different deployment
//       const latestTime = await time.latest();
//       const Lock = await ethers.getContractFactory("Lock");
//       await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
//         "Unlock time should be in the future"
//       );
//     });
//   });

//   describe("Withdrawals", function () {
//     describe("Validations", function () {
//       it("Should revert with the right error if called too soon", async function () {
//         const { lock } = await loadFixture(deployOneYearLockFixture);

//         await expect(lock.withdraw()).to.be.revertedWith(
//           "You can't withdraw yet"
//         );
//       });

//       it("Should revert with the right error if called from another account", async function () {
//         const { lock, unlockTime, otherAccount } = await loadFixture(
//           deployOneYearLockFixture
//         );

//         // We can increase the time in Hardhat Network
//         await time.increaseTo(unlockTime);

//         // We use lock.connect() to send a transaction from another account
//         await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
//           "You aren't the owner"
//         );
//       });

//       it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
//         const { lock, unlockTime } = await loadFixture(
//           deployOneYearLockFixture
//         );

//         // Transactions are sent using the first signer by default
//         await time.increaseTo(unlockTime);

//         await expect(lock.withdraw()).not.to.be.reverted;
//       });
//     });

//     describe("Events", function () {
//       it("Should emit an event on withdrawals", async function () {
//         const { lock, unlockTime, lockedAmount } = await loadFixture(
//           deployOneYearLockFixture
//         );

//         await time.increaseTo(unlockTime);

//         await expect(lock.withdraw())
//           .to.emit(lock, "Withdrawal")
//           .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
//       });
//     });

//     describe("Transfers", function () {
//       it("Should transfer the funds to the owner", async function () {
//         const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
//           deployOneYearLockFixture
//         );

//         await time.increaseTo(unlockTime);

//         await expect(lock.withdraw()).to.changeEtherBalances(
//           [owner, lock],
//           [lockedAmount, -lockedAmount]
//         );
//       });
//     });
//   });
// });
