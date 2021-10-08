import { LiquidationDayData } from '../../schema'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export function updateLiquidationDayData(event: LiquidationBorrow): LiquidationDayData {
  const timestamp = event.block.timestamp.toI32()

  const day = timestamp / 86400

  const id = event.address.toHex().concat('-').concat(BigInt.fromI32(day).toString())

  let liquidationDayData = LiquidationDayData.load(id)
  const liquidationBlock = event.params.liquidationBorrowMantissa

  if (liquidationDayData === null) {
    liquidationDayData = new liquidationDayData(id)
    liquidationDayData.date = day * 86400
    liquidationDayData.amount = BigDecimal.fromString('0')
    liquidationDayData.amountUSD = BigDecimal.fromString('0')
    liquidationDayData.txCount = BigInt.fromI32(0)
    liquidationDayData.jTokenSymbol =  liquidationBlock.jTokenSymbol
    liquidationDayData.underlyingSymbol = liquidationBlock.underlyingSymbol
    liquidationDayData.underlyingRepayAmount = BigDecimal.fromString('0')
    liquidationDayData.liquidationEvents = []
  }

  const liquidationBlockAmountUSD = liquidationBlock.amount.multipliedBy(liquidationDayData.underlyingRepayAmount)

  liquidationDayData.amount = liquidationDayData.amount.plus(liquidationBlock.amount)
  liquidationDayData.amountUSD = liquidationDayData.amountUSD.plus(liquidationBlockAmountUSD)
  liquidationDayData.txCount = liquidationDayData.txCount.plus(BigInt.fromI32(1))
  liquidationDayData.underlyingRepayAmount = liquidationDayData.underlyingRepayAmount.plus(liquidationBlock.underlyingRepayAmount)  
  liquidationDayData.liquidationEvents.push(liquidationBlock)
  liquidationDayData.save()

  return liquidationDayData as LiquidationDayData
}
