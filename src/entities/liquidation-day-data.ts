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

  let liquidationDayData = createLiquidationDayData(event, liquidationBlock)

  const market = Market.load(event.address.toHexString())

  const liquidationBlockAmountUSD = liquidationBlock.underlyingRepayAmount.times(
    market.underlyingPriceUSD,
  )

  liquidationDayData.amount = liquidationDayData.amount.plus(liquidationBlock.amount)
  liquidationDayData.amountUSD = liquidationDayData.amountUSD.plus(
    liquidationBlockAmountUSD,
  )
  liquidationDayData.txCount = liquidationDayData.txCount + 1
  liquidationDayData.underlyingRepayAmount = liquidationDayData.underlyingRepayAmount.plus(
    liquidationBlock.underlyingRepayAmount,
  )
  liquidationDayData.liquidationEvents.push(liquidationBlock.id)
  liquidationDayData.save()

  return liquidationDayData as LiquidationDayData
}

function createLiquidationDayData(
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
    liquidationDayData.amountUSD = zeroBD
    liquidationDayData.txCount = 0
    liquidationDayData.jTokenSymbol = liquidationBlock.jTokenSymbol
    liquidationDayData.underlyingSymbol = liquidationBlock.underlyingSymbol
    liquidationDayData.underlyingRepayAmount = zeroBD
    liquidationDayData.liquidationEvents = []
  }

  return liquidationDayData
}
