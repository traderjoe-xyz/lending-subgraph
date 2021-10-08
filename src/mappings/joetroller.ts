/* eslint-disable prefer-const */ // to satisfy AS compiler

import {
  MarketEntered,
  MarketExited,
  NewCloseFactor,
  NewCollateralFactor,
  NewLiquidationIncentive,
  NewPriceOracle,
  MarketListed,
  LiquidationBorrow
} from '../types/Joetroller/Joetroller'

import { JToken } from '../types/templates'
import { Market, Joetroller, Account } from '../types/schema'
import { mantissaFactorBD, updateCommonJTokenStats, createAccount } from './helpers'
import { createMarket } from './markets'
import { updateLiquidationDayData } from '../entities/liquidation-day-data'

let invalid_markets: string[] = []

export function handleMarketListed(event: MarketListed): void {
  if (invalid_markets.indexOf(event.params.jToken.toHexString()) !== -1) {
    return
  }
  // Dynamically index all new listed tokens
  JToken.create(event.params.jToken)
  // Create the market for this token, since it's now been listed.
  let market = createMarket(event.params.jToken.toHexString())
  market.save()
}

export function handleMarketEntered(event: MarketEntered): void {
  let market = Market.load(event.params.jToken.toHexString())
  // Null check needed to avoid crashing on a new market added. Ideally when dynamic data
  // sources can source from the contract creation block and not the time the
  // joetroller adds the market, we can avoid this altogether
  if (market != null) {
    let accountID = event.params.account.toHex()
    let account = Account.load(accountID)
    if (account == null) {
      account = createAccount(accountID)
    }

    let jTokenStats = updateCommonJTokenStats(
      market.id,
      market.symbol,
      accountID,
      event.transaction.hash,
      event.block.timestamp,
      event.block.number,
      event.logIndex,
    )
    jTokenStats.enteredMarket = true
    jTokenStats.save()
  }
}

export function handleMarketExited(event: MarketExited): void {
  let market = Market.load(event.params.jToken.toHexString())
  // Null check needed to avoid crashing on a new market added. Ideally when dynamic data
  // sources can source from the contract creation block and not the time the
  // joetroller adds the market, we can avoid this altogether
  if (market != null) {
    let accountID = event.params.account.toHex()
    let account = Account.load(accountID)
    if (account == null) {
      account = createAccount(accountID)
    }

    let jTokenStats = updateCommonJTokenStats(
      market.id,
      market.symbol,
      accountID,
      event.transaction.hash,
      event.block.timestamp,
      event.block.number,
      event.logIndex,
    )
    jTokenStats.enteredMarket = false
    jTokenStats.save()
  }
}

export function handleNewCloseFactor(event: NewCloseFactor): void {
  let joetroller = Joetroller.load('1')
  // This is the first event used in this mapping, so we use it to create the entity
  if (joetroller == null) {
    joetroller = new Joetroller('1')
  }
  joetroller.closeFactor = event.params.newCloseFactorMantissa
  joetroller.save()
}

export function handleNewCollateralFactor(event: NewCollateralFactor): void {
  let market = Market.load(event.params.jToken.toHexString())
  // Null check needed to avoid crashing on a new market added. Ideally when dynamic data
  // sources can source from the contract creation block and not the time the
  // joetroller adds the market, we can avoid this altogether
  if (market != null) {
    market.collateralFactor = event.params.newCollateralFactorMantissa
      .toBigDecimal()
      .div(mantissaFactorBD)
    market.save()
  }
}

// This should be the first event acccording to etherscan but it isn't.... price oracle is. weird
export function handleNewLiquidationIncentive(event: NewLiquidationIncentive): void {
  let joetroller = Joetroller.load('1')
  joetroller.liquidationIncentive = event.params.newLiquidationIncentiveMantissa

  joetroller.save()
}

export function handleLiquidateBorrow(event: LiquidationBorrow): void {
  let joetroller = Joetroller.load('1')
  joetroller.liquidationBorrow = event.params.LiquidationBorrowMantissa

  updateLiquidationDayData(event)

  joetroller.save()
}

export function handleNewPriceOracle(event: NewPriceOracle): void {
  let joetroller = Joetroller.load('1')
  joetroller.priceOracle = event.params.newPriceOracle
  joetroller.save()
}
