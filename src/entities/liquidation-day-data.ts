import { LiquidationDayData, LiquidationEvent, Market } from '../../schema'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export function updateLiquidationDayData(event: NewLiquidationIncentive): LiquidationDayData {
  const timestamp = event.block.timestamp.toI32()

  const day = timestamp / 86400

  const id = event.address.toHex().concat('-').concat(BigInt.fromI32(day).toString())

  let liquidationDayData = LiquidationDayData.load(id)
  let market = Market.load(event.address.toHex())

  //need to get the actual liquidation block here
  const liquidationEvent = LiquidationEvent.load(event.address.toHex())

  if (liquidationDayData === null) {
    liquidationDayData = new liquidationDayData(id)
    liquidationDayData.date = day * 86400
    liquidationDayData.amount = BigDecimal.fromString('0')
    liquidationDayData.txCount = BigDecimal.fromString('0')
    liquidationDayData.jTokenSymbol =  market.symbol
    liquidationDayData.underlyingSymbol = market.underlyingSymbol
    liquidationDayData.underlyingRepayAmount = BigDecimal.fromString('0')
    liquidationDayData.liquidationEvents = []
  }

  liquidationDayData.amount = liquidationDayData.amount.plus(liquidationEvent.amount)
  liquidationDayData.txCount = liquidationDayData.txCount.plus(BigInt.fromI32(1))
  liquidationDayData.underlyingRepayAmount =  liquidationDayData.underlyingRepayAmount.plus(liquidationEvent.underlyingRepayAmount)  

  liquidationDayData.save()

  return liquidationDayData as LiquidationDayData
}
