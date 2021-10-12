import {
  MarketDayData,
  Market,
  MintEvent,
  RedeemEvent,
  BorrowEvent,
  RepayEvent,
} from '../types/schema'
import { BigInt } from '@graphprotocol/graph-ts'
import { Mint, Redeem, Borrow, RepayBorrow } from '../types/templates/JToken/JToken'
import { zeroBD } from '../mappings/helpers'

export function updateMarketDayDataMint(event: Mint): MarketDayData {
  const timestamp = event.block.timestamp.toI32()

  const day = timestamp / 86400

  const id = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(day).toString())
  let marketDayData = MarketDayData.load(id)
  const mintID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  const mintBlock = MintEvent.load(mintID)
  const market = Market.load(event.address.toHexString())

  if (marketDayData === null) {
    marketDayData = new MarketDayData(id)
    marketDayData.date = day * 86400
    marketDayData.txCount = 0
    marketDayData.totalBorrows = zeroBD
    marketDayData.totalBorrowsUSD = zeroBD
    marketDayData.totalSupply = zeroBD
    marketDayData.totalSupplyUSD = zeroBD
    marketDayData.market = market.id
  }

  marketDayData.txCount = marketDayData.txCount + 1
  marketDayData.totalSupply = marketDayData.totalSupply.plus(mintBlock.amount)
  marketDayData.totalSupplyUSD = marketDayData.totalSupplyUSD.plus(
    mintBlock.underlyingAmount.times(market.underlyingPriceUSD),
  )

  marketDayData.save()

  return marketDayData as MarketDayData
}

export function updateMarketDayDataRedeem(event: Redeem): MarketDayData {
  const timestamp = event.block.timestamp.toI32()

  const day = timestamp / 86400

  const id = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(day).toString())
  let marketDayData = MarketDayData.load(id)
  const mintID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  const redeemBlock = RedeemEvent.load(mintID)
  const market = Market.load(event.address.toHexString())

  if (marketDayData === null) {
    marketDayData = new MarketDayData(id)
    marketDayData.date = day * 86400
    marketDayData.txCount = 0
    marketDayData.totalBorrows = zeroBD
    marketDayData.totalBorrowsUSD = zeroBD
    marketDayData.totalSupply = zeroBD
    marketDayData.totalSupplyUSD = zeroBD
    marketDayData.market = market.id
  }

  marketDayData.txCount = marketDayData.txCount + 1
  marketDayData.totalSupply = marketDayData.totalSupply.minus(redeemBlock.amount)
  marketDayData.totalSupplyUSD = marketDayData.totalSupplyUSD.minus(
    redeemBlock.underlyingAmount.times(market.underlyingPriceUSD),
  )

  marketDayData.save()

  return marketDayData as MarketDayData
}

export function updateMarketDayDataBorrow(event: Borrow): MarketDayData {
  const timestamp = event.block.timestamp.toI32()

  const day = timestamp / 86400

  const id = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(day).toString())
  let marketDayData = MarketDayData.load(id)
  const mintID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  const borrowBlock = BorrowEvent.load(mintID)
  const market = Market.load(event.address.toHexString())

  if (marketDayData === null) {
    marketDayData = new MarketDayData(id)
    marketDayData.date = day * 86400
    marketDayData.txCount = 0
    marketDayData.totalBorrows = zeroBD
    marketDayData.totalBorrowsUSD = zeroBD
    marketDayData.totalSupply = zeroBD
    marketDayData.totalSupplyUSD = zeroBD
    marketDayData.market = market.id
  }

  marketDayData.txCount = marketDayData.txCount + 1
  marketDayData.totalBorrows = marketDayData.totalBorrows.plus(borrowBlock.amount)
  marketDayData.totalBorrowsUSD = marketDayData.totalBorrowsUSD.plus(
    borrowBlock.amount.times(market.underlyingPriceUSD),
  )

  marketDayData.save()

  return marketDayData as MarketDayData
}

export function updateMarketDayDataRepay(event: RepayBorrow): MarketDayData {
  const timestamp = event.block.timestamp.toI32()

  const day = timestamp / 86400

  const id = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(day).toString())
  let marketDayData = MarketDayData.load(id)
  const mintID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  const repayBlock = RepayEvent.load(mintID)
  const market = Market.load(event.address.toHexString())

  if (marketDayData === null) {
    marketDayData = new MarketDayData(id)
    marketDayData.date = day * 86400
    marketDayData.txCount = 0
    marketDayData.totalBorrows = zeroBD
    marketDayData.totalBorrowsUSD = zeroBD
    marketDayData.totalSupply = zeroBD
    marketDayData.totalSupplyUSD = zeroBD
    marketDayData.market = market.id
  }

  marketDayData.txCount = marketDayData.txCount + 1
  marketDayData.totalBorrows = marketDayData.totalBorrows.minus(repayBlock.amount)
  marketDayData.totalBorrowsUSD = marketDayData.totalBorrowsUSD.minus(
    repayBlock.amount.times(market.underlyingPriceUSD),
  )

  marketDayData.save()

  return marketDayData as MarketDayData
}
