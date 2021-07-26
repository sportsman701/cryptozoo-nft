const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { makeAnimal, MarketStatus, Specie, time } = require("./utils");

const { expect } = chai;

chai.use(solidity);

describe("CryptoAnimal breed", function () {
  beforeEach(async function () {
    const CryptoAnimal = await ethers.getContractFactory("CryptoAnimal");
    this.cryptoAnimal = await CryptoAnimal.deploy("CryptoAnimal", "CRTA");
    await this.cryptoAnimal.deployed();

    this.users = await ethers.getSigners();
    this.alice = this.users[0]
    this.bob = this.users[1]
    this.carl = this.users[2]

    
    this.animal1 = makeAnimal({
      inBreedMarket: false,
      matronId: 0,
      sireId: 0,
      breedPrice: 100,
      price: 100,
      generation: 0,
      breedCount: 3,
      dna: 0,
      inMarket: MarketStatus.NONE,
      eggTime: Math.round(Date.now() / 1000),
      hatchTime: 0,
      lastBreedTime: Math.round(Date.now() / 1000),
      specie: Specie.GORILLA
    })

    this.animal2 = this.animal1

    const owner = await this.cryptoAnimal.connect(this.alice);
    await owner.mintToken(this.bob.address, this.animal1)
    await owner.mintToken(this.carl.address, this.animal2)
    this.withTokenOwner = await this.cryptoAnimal.connect(this.bob);
  })

  it("should not work for non token owner", async function() {
    const withCarl = await this.cryptoAnimal.connect(this.carl);
    await expect(withCarl.breed(0, 1))
      .to.be.revertedWith("Animal: caller is not the token owner");
  })

  it("should not work if partner animal id is invalid", async function() {
    const withCarl = await this.cryptoAnimal.connect(this.carl);
    await expect(withCarl.breed(1, 2))
      .to.be.revertedWith("Animal: invalid token id");
  })

  it("should not work if partner animal is not in market", async function() {
    const withCarl = await this.cryptoAnimal.connect(this.carl);
    await expect(withCarl.breed(1, 0))
      .to.be.revertedWith("Animal: partner animal is not in breed market");
  })

  it("should not work if price doesn't match", async function() {
    const withBob = await this.cryptoAnimal.connect(this.bob);
    const withCarl = await this.cryptoAnimal.connect(this.carl);

    await withBob.setBreedMarketStatus(0, true);
    await expect(withCarl.breed(1, 0, { value: 99 }))
      .to.be.revertedWith("Animal: incorrect breed cost");
  })

  it("should not work if animal didn't hatch", async function() {
    const withBob = await this.cryptoAnimal.connect(this.bob);
    const withCarl = await this.cryptoAnimal.connect(this.carl);

    await withBob.setBreedMarketStatus(0, true);
    await expect(withCarl.breed(1, 0, { value: 100 }))
      .to.be.revertedWith("Animal: your animal can't breed");
  })

  it("should not work if animal is before breed cool down time", async function() {
    const withBob = await this.cryptoAnimal.connect(this.bob);
    const withCarl = await this.cryptoAnimal.connect(this.carl);
    const hatchFee = BigNumber.from(10).pow(17);

    await withBob.setBreedMarketStatus(0, true);

    await time.increase(36 * 3600 + 1);
    await withBob.hatch(0, { value: hatchFee });
    await withCarl.hatch(1, { value: hatchFee });

    await expect(withCarl.breed(1, 0, { value: 100 }))
      .to.be.revertedWith("Animal: your animal can't breed");
  })

  it("check it works", async function() {
    const withBob = await this.cryptoAnimal.connect(this.bob);
    const withCarl = await this.cryptoAnimal.connect(this.carl);
    const mktsqBalance = await ethers.provider.getBalance(this.alice.address)
    const hatchFee = BigNumber.from(10).pow(17);

    await withBob.setBreedMarketStatus(0, true);

    await time.increase(36 * 3600 + 1);
    await withBob.hatch(0, { value: hatchFee });
    await withCarl.hatch(1, { value: hatchFee });

    await time.increase(72 * 3600 + 1);

    await expect(withCarl.breed(1, 0, { value: 100 }))
      .to.emit(withCarl, "newEgg")
      .withArgs(this.carl.address, 1, 0, 2);

    expect(await ethers.provider.getBalance(this.alice.address))
      .to.equal(mktsqBalance.add(hatchFee).add(hatchFee).add(3));
    expect(await withCarl.ownerOf(2)).to.equal(this.carl.address);
  })
});
