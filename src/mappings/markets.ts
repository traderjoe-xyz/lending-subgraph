/* eslint-disable prefer-const */ // to satisfy AS compiler

// For each division by 10, add one to exponent to truncate one significant figure
import {
  Address,
  BigDecimal,
  BigInt,
  dataSource,
  ethereum,
  log,
} from '@graphprotocol/graph-ts'
import { Market, Joetroller } from '../types/schema'
import { PriceOracle } from '../types/templates/JToken/PriceOracle'
import { ERC20 } from '../types/templates/JToken/ERC20'
import { AccrueInterest, JToken } from '../types/templates/JToken/JToken'
import { JCollateralCapErc20 } from '../types/templates/JToken/JCollateralCapErc20'
import { JWrappedNative } from '../types/templates/JToken/JWrappedNative'

import {
  exponentToBigDecimal,
  mantissaFactor,
  mantissaFactorBD,
  jTokenDecimalsBD,
  oneBD,
  zeroBD,
} from './helpers'

let network = dataSource.network()

let jAVAXAddress: string =
  network == 'avalanche'
    ? '0xc22f01ddc8010ee05574028528614634684ec29e' // avalanche
    : '0xaafe9d8346aefd57399e86d91bbfe256dc0dcac0' // rinkeby

let jUSDCAddress =
  network == 'avalanche'
    ? '0xed6aaf91a2b084bd594dbd1245be3691f9f637ac' // avalanche
    : '0xe0447d1112ece174f2b351461367f9fbf9382661' // rinkeby

let secondsPerYear = '31536000'

let secondsPerTenMin = 60

// Used for all jERC20 contracts
function getUnderlyingPriceUSD(
  eventAddress: Address,
  underlyingAddress: Address,
  underlyingDecimals: i32,
): BigDecimal {
  let joetroller = Joetroller.load('1')
  let oracleAddress = joetroller.priceOracle as Address
  let underlyingPrice: BigDecimal
  if (oracleAddress.toHexString() == '0x') {
    return zeroBD
  }

  let mantissaDecimalFactor = 18 - underlyingDecimals + 18
  let bdFactor = exponentToBigDecimal(mantissaDecimalFactor)
  let oracle = PriceOracle.bind(oracleAddress)
  if (
    oracle.aggregators(eventAddress) ==
    Address.fromString('0x0000000000000000000000000000000000000000')
  ) {
    return BigDecimal.fromString('0')
  }
  underlyingPrice = oracle
    .getUnderlyingPrice(eventAddress)
    .toBigDecimal()
    .div(bdFactor)

  return underlyingPrice
}

export function createMarket(marketAddress: string): Market {
  let market: Market

  // It is JAVAX, which has a slightly different interface
  if (
    marketAddress == jAVAXAddress ||
    marketAddress == '0x0444dcf838055493519f26021de63afa72eee0d2'
  ) {
    let contract = JWrappedNative.bind(Address.fromString(marketAddress))
    market = new Market(marketAddress)
    market.underlyingAddress = contract.underlying()
    market.underlyingDecimals = 18
    market.underlyingPriceUSD = zeroBD

    if (network == 'avalanche') {
      market.underlyingName = 'AVAX'
      market.underlyingSymbol = 'AVAX'
    } else {
      market.underlyingName = 'Ether'
      market.underlyingSymbol = 'ETH'
    }
    // It is all other JERC20 contracts
  } else {
    let contract = JCollateralCapErc20.bind(Address.fromString(marketAddress))
    market = new Market(marketAddress)
    market.underlyingAddress = contract.underlying()
    let underlyingContract = ERC20.bind(market.underlyingAddress as Address)
    market.underlyingDecimals = underlyingContract.decimals()
    market.underlyingName = underlyingContract.name()
    market.underlyingSymbol = underlyingContract.symbol()
    market.underlyingPriceUSD = zeroBD
    if (marketAddress == jUSDCAddress) {
      market.underlyingPriceUSD = BigDecimal.fromString('1')
    }
  }

  let contract = JToken.bind(Address.fromString(marketAddress))
  market.totalInterestAccumulatedExact = BigInt.fromI32(0)
  market.totalInterestAccumulated = zeroBD

  let interestRateModelAddress = contract.try_interestRateModel()
  let reserveFactor = contract.try_reserveFactorMantissa()

  market.borrowRate = zeroBD
  market.cash = zeroBD
  market.collateralFactor = zeroBD
  market.exchangeRate = zeroBD
  market.interestRateModelAddress = interestRateModelAddress.reverted
    ? Address.fromString('0x0000000000000000000000000000000000000000')
    : interestRateModelAddress.value
  market.name = contract.name()
  market.reserves = zeroBD
  market.supplyRate = zeroBD
  market.symbol = contract.symbol()
  market.totalBorrows = zeroBD
  market.totalSupply = zeroBD

  market.accrualBlockTimestamp = 0
  market.blockTimestamp = 0
  market.borrowIndex = oneBD
  market.reserveFactor = reserveFactor.reverted ? BigInt.fromI32(0) : reserveFactor.value

  return market
}

export function updateMarket(event: AccrueInterest): Market {
  let marketAddress = event.address
  let blockNumber = event.block.number.toI32()
  let blockTimestamp = event.block.timestamp.toI32()

  let marketID = marketAddress.toHexString()
  let market = Market.load(marketID)
  if (market == null) {
    market = createMarket(marketID)
  }

  // Only updateMarket if it has not been updated this block
  if (market.accrualBlockTimestamp != blockTimestamp) {
    let contractAddress = Address.fromString(market.id)
    let contract = JToken.bind(contractAddress)

    const underlyingPriceUSD = market.underlyingPriceUSD
    if (
      underlyingPriceUSD.equals(zeroBD) ||
      blockTimestamp - market.accrualBlockTimestamp > secondsPerTenMin
    ) {
      market.underlyingPriceUSD = getUnderlyingPriceUSD(
        contractAddress,
        market.underlyingAddress as Address,
        market.underlyingDecimals,
      ).truncate(market.underlyingDecimals)
    }

    market.totalSupply = contract
      .totalSupply()
      .toBigDecimal()
      .div(jTokenDecimalsBD)

    /* Exchange rate explanation
       In Practice
        - If you call the jDAI contract on etherscan it comes back (2.0 * 10^26)
        - If you call the jUSDC contract on etherscan it comes back (2.0 * 10^14)
        - The real value is ~0.02. So jDAI is off by 10^28, and jUSDC 10^16
       How to calculate for tokens with different decimals
        - Must div by tokenDecimals, 10^market.underlyingDecimals
        - Must multiply by ctokenDecimals, 10^8
        - Must div by mantissa, 10^18
     */

    // Only update if it has not been updated in 10 minutes to speed up syncing process
    if (
      market.exchangeRate.equals(zeroBD) ||
      blockTimestamp - market.accrualBlockTimestamp > secondsPerTenMin
    ) {
      market.exchangeRate = contract
        .exchangeRateStored()
        .toBigDecimal()
        .div(exponentToBigDecimal(market.underlyingDecimals))
        .times(jTokenDecimalsBD)
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)
    }

    market.borrowIndex = event.params.borrowIndex
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)

    // Only update if it has not been updated in 10 minutes to speed up syncing process
    if (blockTimestamp - market.accrualBlockTimestamp > secondsPerTenMin) {
      market.reserves = contract
        .totalReserves()
        .toBigDecimal()
        .div(exponentToBigDecimal(market.underlyingDecimals))
        .truncate(market.underlyingDecimals)
    }

    market.totalBorrows = event.params.totalBorrows
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals))
      .truncate(market.underlyingDecimals)
    market.cash = event.params.cashPrior
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals))
      .truncate(market.underlyingDecimals)

    // Only update if it has not been updated in 10 minutes to speed up syncing process
    if (blockTimestamp - market.accrualBlockTimestamp > secondsPerTenMin) {
      // Must convert to BigDecimal, and remove 10^18 that is used for Exp in Compound Solidity
      market.borrowRate = contract
        .borrowRatePerSecond()
        .toBigDecimal()
        .times(BigDecimal.fromString(secondsPerYear))
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)

      // This fails on only the first call to cZRX. It is unclear why, but otherwise it works.
      // So we handle it like this.
      let supplyRatePerSecond = contract.try_supplyRatePerSecond()
      if (supplyRatePerSecond.reverted) {
        log.info('***CALL FAILED*** : jERC20 supplyRatePerSecond() reverted', [])
        market.supplyRate = zeroBD
      } else {
        market.supplyRate = supplyRatePerSecond.value
          .toBigDecimal()
          .times(BigDecimal.fromString(secondsPerYear))
          .div(mantissaFactorBD)
          .truncate(mantissaFactor)
      }
    }

    market.accrualBlockTimestamp = blockTimestamp
    market.blockTimestamp = blockTimestamp

    market.totalInterestAccumulatedExact = market.totalInterestAccumulatedExact.plus(
      event.params.interestAccumulated,
    )
    market.totalInterestAccumulated = market.totalInterestAccumulatedExact
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals))
      .truncate(market.underlyingDecimals)

    market.save()
  }
  return market as Market
}
