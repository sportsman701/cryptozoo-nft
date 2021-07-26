const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const { makeAnimal, MarketStatus, Specie, time } = require("./utils");

const { expect } = chai;

chai.use(solidity);

describe("CryptoAnimal hatch", function () {
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

    const owner = await this.cryptoAnimal.connect(this.alice);
    await owner.mintToken(this.bob.address, this.animal1)
  })

  it("should not work for non token owner", async function() {
    const withCarl = await this.cryptoAnimal.connect(this.carl);
    await expect(withCarl.hatch(0))
      .to.be.revertedWith("Animal: caller is not the token owner");
  });

  it("should not work for invalid token", async function() {
    const withCarl = await this.cryptoAnimal.connect(this.carl);
    await expect(withCarl.hatch(2))
      .to.be.revertedWith("ERC721: owner query for nonexistent token");
  });

  it("should not work before hatch ready time", async function() {
    const withBob = await this.cryptoAnimal.connect(this.bob);
    await expect(withBob.hatch(0))
      .to.be.revertedWith("Animal: not ready to hatch");
  });

  it("should not work with incorrect hatch fee", async function() {
    const withBob = await this.cryptoAnimal.connect(this.bob);
    await time.increase(36 * 3600 + 1);
    await expect(withBob.hatch(0, { value: 1 }))
      .to.be.revertedWith("Animal: incorrect hatch fee");
  });

  it("check it works", async function() {
    const mktsqBalance = await ethers.provider.getBalance(this.alice.address);
    const withBob = await this.cryptoAnimal.connect(this.bob);
    const hatchFee = BigNumber.from(10).pow(17);

    await time.increase(36 * 3600 + 1);
    await expect(withBob.hatch(0, { value: hatchFee }))
      .to.emit(withBob, "hatched")
      .withArgs(this.bob.address, 0);

    expect(await withBob.animals(0))
      .to.not.have.deep.property("time.hatchTime", 0);

    expect(await ethers.provider.getBalance(this.alice.address))
      .to.equal(mktsqBalance.add(hatchFee));

    expect(await withBob.didHatch(0)).to.equal(true);
  });
});
