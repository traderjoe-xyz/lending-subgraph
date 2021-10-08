import { MarketDayData, Market } from '../../schema'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export function updateMarketDayDataMint(event: Mint): MarketDayData {
  let marketDayData = setupMarketDayData(event)

  const mintBlock = event.params.mintMantissa

  marketDayData.txCount = marketDayData.txCount.plus(BigInt.fromI32(1))
  marketDayData.totalSupply = marketDayData.totalSupply.plus(mintBlock.amount)  
  marketDayData.totalSupplyUSD = marketDayData.totalSupplyUSD.plus(mintBlock.underlyingAmount)  

  marketDayData.save()

  return marketDayData as MarketDayData
}

export function updateMarketDayDataRedeem(event: Redeem): MarketDayData {
  let marketDayData = setupMarketDayData(event)

  const redeemBlock = event.params.redeemMantissa

  marketDayData.txCount = marketDayData.txCount.plus(BigInt.fromI32(1))
  marketDayData.totalSupply = marketDayData.totalSupply.minus(redeemBlock.amount)  
  marketDayData.totalSupplyUSD = marketDayData.totalSupplyUSD.minus(redeemBlock.underlyingAmount)  

  marketDayData.save()

  return marketDayData as MarketDayData
}

export function updateMarketDayDataBorrow(event: Borrow): MarketDayData {
  let marketDayData = setupMarketDayData(event)

  const borrowBlock = event.params.borrowMantissa

  marketDayData.txCount = marketDayData.txCount.plus(BigInt.fromI32(1))
  marketDayData.totalBorrow = marketDayData.totalBorrow.plus(borrowBlock.amount)  
  marketDayData.totalBorrowUSD = marketDayData.totalBorrowUSD.plus(borrowBlock.underlyingAmount)  

  marketDayData.save()

  return marketDayData as MarketDayData
}

export function updateMarketDayDataRepay(event: Repay): MarketDayData {
  let marketDayData = setupMarketDayData(event)

  const repayBlock = event.params.repayMantissa

  marketDayData.txCount = marketDayData.txCount.plus(BigInt.fromI32(1))
  marketDayData.totalBorrow = marketDayData.totalBorrow.minus(repayBlock.amount)  
  marketDayData.totalBorrowUSD = marketDayData.totalBorrowUSD.minus(repayBlock.underlyingAmount)  

  marketDayData.save()

  return marketDayData as MarketDayData
}

function setupMarketDayData(event: Mint | Redeem | Borrow | RepayBorrow): MarketDayData {
  const timestamp = event.block.timestamp.toI32()

  const day = timestamp / 86400

  const id = event.address.toHex().concat('-').concat(BigInt.fromI32(day).toString())

  let marketDayData = MarketDayData.load(id)
  const market = Market.load(event.address.toHex())

  if (marketDayData === null) {
    marketDayData = new marketDayData(id)
    marketDayData.date = day * 86400
    marketDayData.txCount = BigInt.fromI32(0)
    marketDayData.cash = BigDecimal.fromString('0')
    marketDayData.reserves = BigDecimal.fromString('0')
    marketDayData.totalBorrows = BigDecimal.fromString('0')
    marketDayData.totalBorrowsUSD = BigDecimal.fromString('0')
    marketDayData.totalSupply = BigDecimal.fromString('0')
    marketDayData.totalSupplyUSD =  BigDecimal.fromString('0')
    marketDayData.market = market
  }

  return marketDayData
}
