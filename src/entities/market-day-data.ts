import { BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
  MarketDayData,
  Market,
  MintEvent,
  RedeemEvent,
  BorrowEvent,
  RepayEvent,
} from '../types/schema'
import { Mint, Redeem, Borrow, RepayBorrow } from '../types/templates/JToken/JToken'
import { zeroBD } from '../mappings/helpers'

export function getMarketDataData(event: ethereum.Event): MarketDayData {
  const timestamp = event.block.timestamp.toI32()
  const day = timestamp / 86400
  const id = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(day).toString())

  const market = Market.load(event.address.toHexString())

  let marketDayData = MarketDayData.load(id)
  if (marketDayData == null) {
    marketDayData = new MarketDayData(id)
    marketDayData.date = day * 86400
    marketDayData.txCount = 0
    marketDayData.totalBorrows = zeroBD
    marketDayData.totalBorrowsUSD = zeroBD
    marketDayData.totalSupply = zeroBD
    marketDayData.totalSupplyUSD = zeroBD
    marketDayData.totalReservesUSD = zeroBD
    marketDayData.market = market.id
  }
  marketDayData.save()
  return marketDayData as MarketDayData
}

export function updateMarketDayData(event: ethereum.Event): MarketDayData {
  const marketDayData = getMarketDataData(event)
  const market = Market.load(event.address.toHexString())

  marketDayData.txCount = marketDayData.txCount + 1
  marketDayData.totalBorrows = market.totalBorrows
  marketDayData.totalBorrowsUSD = market.totalBorrows.times(market.underlyingPriceUSD)
  marketDayData.totalSupply = market.totalSupply
  marketDayData.totalSupplyUSD = market.totalSupply
    .times(market.exchangeRate)
    .times(market.underlyingPriceUSD)
  marketDayData.totalReservesUSD = market.reserves.times(market.underlyingPriceUSD)
  marketDayData.save()
  return marketDayData as MarketDayData
}
