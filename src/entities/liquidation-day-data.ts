import { LiquidationDayData, Market, LiquidationEvent } from '../types/schema'
import { BigInt } from '@graphprotocol/graph-ts'
import { zeroBD } from '../mappings/helpers'
import { LiquidateBorrow } from '../types/templates/JToken/JToken'

export function updateLiquidationDayData(event: LiquidateBorrow): LiquidationDayData {
  const mintID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  const liquidationBlock = LiquidationEvent.load(mintID)

  let liquidationDayData = setupLiquidationDayData(
    event as LiquidateBorrow,
    liquidationBlock as LiquidationEvent,
  )

  const market = Market.load(event.address.toHexString())

  const liquidationBlockAmountUSD = liquidationBlock.underlyingRepayAmount.times(
    market.underlyingPriceUSD,
  )

  liquidationDayData.amount = liquidationDayData.amount.plus(liquidationBlock.amount)
  liquidationDayData.repaidUSD = liquidationDayData.repaidUSD.plus(
    liquidationBlockAmountUSD,
  )
  liquidationDayData.txCount = liquidationDayData.txCount + 1
  liquidationDayData.underlyingRepayAmount = liquidationDayData.underlyingRepayAmount.plus(
    liquidationBlock.underlyingRepayAmount,
  )
  liquidationDayData.save()

  return liquidationDayData as LiquidationDayData
}

function setupLiquidationDayData(
  event: LiquidateBorrow,
  liquidationBlock: LiquidationEvent,
): LiquidationDayData {
  const timestamp = event.block.timestamp.toI32()

  const day = timestamp / 86400

  const id = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(day).toString())

  let liquidationDayData = LiquidationDayData.load(id)

  if (liquidationDayData === null) {
    liquidationDayData = new LiquidationDayData(id)
    liquidationDayData.date = day * 86400
    liquidationDayData.amount = zeroBD
    liquidationDayData.repaidUSD = zeroBD
    liquidationDayData.txCount = 0
    liquidationDayData.jTokenSymbol = liquidationBlock.jTokenSymbol
    liquidationDayData.underlyingSymbol = liquidationBlock.underlyingSymbol
    liquidationDayData.underlyingRepayAmount = zeroBD
  }

  return liquidationDayData as LiquidationDayData
}
