import { LiquidationDayData, Market, LiquidationEvent } from '../types/schema'
import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { zeroBD } from '../mappings/helpers'
import { LiquidateBorrow } from '../types/templates/JToken/JToken'

export function updateLiquidationDayData(event: LiquidateBorrow): LiquidationDayData {
  const mintID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  const liquidationBlock = LiquidationEvent.load(mintID)

  const marketCollateralSeized = Market.load(event.params.jTokenCollateral.toHexString())
  const marketRepayToken = Market.load(event.address.toHexString())

  let liquidationDayData = setupLiquidationDayData(
    event as LiquidateBorrow,
    liquidationBlock as LiquidationEvent,
    marketCollateralSeized as Market,
    marketRepayToken as Market,
  )

  const liquidationBlockSeizedAmountUSD = liquidationBlock.underlyingCollateralSeizedAmount.times(
    marketCollateralSeized.underlyingPriceUSD,
  )
  const liquidationBlockRepayAmountUSD = liquidationBlock.underlyingRepayAmount.times(
    marketRepayToken.underlyingPriceUSD,
  )

  liquidationDayData.underlyingCollateralSeizedAmount = liquidationDayData.underlyingCollateralSeizedAmount.plus(
    liquidationBlock.underlyingCollateralSeizedAmount,
  )
  liquidationDayData.underlyingCollateralSeizedAmountUSD = liquidationDayData.underlyingCollateralSeizedAmountUSD.plus(
    liquidationBlockSeizedAmountUSD,
  )
  liquidationDayData.underlyingRepayAmount = liquidationDayData.underlyingRepayAmount.plus(
    liquidationBlock.underlyingRepayAmount,
  )
  liquidationDayData.underlyingRepayAmountUSD = liquidationDayData.underlyingRepayAmountUSD.plus(
    liquidationBlockRepayAmountUSD,
  )
  liquidationDayData.txCount = liquidationDayData.txCount + 1

  liquidationDayData.save()

  return liquidationDayData as LiquidationDayData
}

function setupLiquidationDayData(
  event: LiquidateBorrow,
  liquidationBlock: LiquidationEvent,
  marketCollateralSeized: Market,
  marketRepayToken: Market,
): LiquidationDayData {
  const timestamp = event.block.timestamp.toI32()

  const day = timestamp / 86400

  const id = marketCollateralSeized.id
    .concat('-')
    .concat(marketRepayToken.id)
    .concat('-')
    .concat(BigInt.fromI32(day).toString())

  let liquidationDayData = LiquidationDayData.load(id)

  if (liquidationDayData === null) {
    liquidationDayData = new LiquidationDayData(id)
    liquidationDayData.date = day * 86400
    liquidationDayData.underlyingCollateralSeizedAmount = zeroBD
    liquidationDayData.underlyingCollateralSeizedAmountUSD = zeroBD
    liquidationDayData.underlyingRepayAmount = zeroBD
    liquidationDayData.underlyingRepayAmountUSD = zeroBD
    liquidationDayData.txCount = 0
    liquidationDayData.underlyingCollateralSeizedSymbol =
      liquidationBlock.underlyingCollateralSeizedSymbol
    liquidationDayData.underlyingRepaySymbol = liquidationBlock.underlyingRepaySymbol
    liquidationDayData.underlyingCollateralSeizedAddress = marketCollateralSeized.id
    liquidationDayData.underlyingRepayAddress = marketRepayToken.id
  }

  return liquidationDayData as LiquidationDayData
}
