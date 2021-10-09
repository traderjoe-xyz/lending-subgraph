/* eslint-disable prefer-const */ // to satisfy AS compiler
import { Address, dataSource } from '@graphprotocol/graph-ts'
import {
  Mint,
  Redeem,
  Borrow,
  RepayBorrow,
  LiquidateBorrow,
  Transfer,
  AccrueInterest,
  NewReserveFactor,
  NewMarketInterestRateModel,
} from '../types/templates/JToken/JToken'
import { JoeLens } from '../types/Joetroller/JoeLens'
import {
  Market,
  Account,
  MintEvent,
  RedeemEvent,
  LiquidationEvent,
  TransferEvent,
  BorrowEvent,
  RepayEvent,
} from '../types/schema'

import { createMarket, updateMarket } from './markets'
import {
  createAccount,
  updateCommonJTokenStats,
  exponentToBigDecimal,
  jTokenDecimalsBD,
  jTokenDecimals,
  mantissaFactorBD,
  mantissaFactor,
} from './helpers'

let network = dataSource.network()
const JOETROLLER_ADDRESS: string =
  network === 'avalanche'
    ? '0x0000000000000000000000000000000000000000' // avalanche
    : '0x5b0a2fa14808e34c5518e19f0dbc39f61d080b11' // rinkeby
const JOELENS_ADDRESS: string =
  network === 'avalanche'
    ? '0x0000000000000000000000000000000000000000'
    : '0x4f101798dd4af8a2a8325f4c54c195a61c59dc62'

/* Account supplies assets into market and receives jTokens in exchange
 *
 * event.mintAmount is the underlying asset
 * event.mintTokens is the amount of jTokens minted
 * event.minter is the account
 *
 * Notes
 *    Transfer event will always get emitted with this
 *    Mints originate from the jToken address, not 0x000000, which is typical of ERC-20s
 *    No need to updateMarket(), handleAccrueInterest() ALWAYS runs before this
 *    No need to updateCommonJTokenStats, handleTransfer() will
 *    No need to update jTokenBalance, handleTransfer() will
 */
export function handleMint(event: Mint): void {
  let market = Market.load(event.address.toHexString())
  let mintID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())
  let accountID = event.params.minter.toHex()

  // Update jTokenStats common for all events, and return the stats to update unique
  // values for each event
  let jTokenStats = updateCommonJTokenStats(
    market.id,
    market.symbol,
    accountID,
    event.transaction.hash,
    event.block.timestamp,
    event.block.number,
    event.logIndex,
  )

  let jTokenAmount = event.params.mintTokens
    .toBigDecimal()
    .div(jTokenDecimalsBD)
    .truncate(jTokenDecimals)
  let underlyingAmount = event.params.mintAmount
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))
    .truncate(market.underlyingDecimals)

  let mint = new MintEvent(mintID)
  mint.amount = jTokenAmount
  mint.to = event.params.minter
  mint.from = event.address
  mint.blockNumber = event.block.number.toI32()
  mint.blockTime = event.block.timestamp.toI32()
  mint.jTokenSymbol = market.symbol
  mint.underlyingAmount = underlyingAmount
  mint.save()
}

/*  Account supplies jTokens into market and receives underlying asset in exchange
 *
 *  event.redeemAmount is the underlying asset
 *  event.redeemTokens is the jTokens
 *  event.redeemer is the account
 *
 *  Notes
 *    Transfer event will always get emitted with this
 *    No need to updateMarket(), handleAccrueInterest() ALWAYS runs before this
 *    No need to updateCommonJTokenStats, handleTransfer() will
 *    No need to update jTokenBalance, handleTransfer() will
 */
export function handleRedeem(event: Redeem): void {
  let market = Market.load(event.address.toHexString())
  let redeemID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())
  let accountID = event.params.redeemer.toHex()

  // Update jTokenStats common for all events, and return the stats to update unique
  // values for each event
  let jTokenStats = updateCommonJTokenStats(
    market.id,
    market.symbol,
    accountID,
    event.transaction.hash,
    event.block.timestamp,
    event.block.number,
    event.logIndex,
  )

  let jTokenAmount = event.params.redeemTokens
    .toBigDecimal()
    .div(jTokenDecimalsBD)
    .truncate(jTokenDecimals)
  let underlyingAmount = event.params.redeemAmount
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))
    .truncate(market.underlyingDecimals)

  let redeem = new RedeemEvent(redeemID)
  redeem.amount = jTokenAmount
  redeem.to = event.address
  redeem.from = event.params.redeemer
  redeem.blockNumber = event.block.number.toI32()
  redeem.blockTime = event.block.timestamp.toI32()
  redeem.jTokenSymbol = market.symbol
  redeem.underlyingAmount = underlyingAmount
  redeem.save()
}

/* Borrow assets from the protocol. All values either AVAX or ERC20
 *
 * event.params.totalBorrows = of the whole market (not used right now)
 * event.params.accountBorrows = total of the account
 * event.params.borrowAmount = that was added in this event
 * event.params.borrower = the account
 * Notes
 *    No need to updateMarket(), handleAccrueInterest() ALWAYS runs before this
 */
export function handleBorrow(event: Borrow): void {
  let market = Market.load(event.address.toHexString())
  let accountID = event.params.borrower.toHex()
  let account = Account.load(accountID)
  if (account == null) {
    account = createAccount(accountID)
  }
  account.hasBorrowed = true

  // Update jTokenStats common for all events, and return the stats to update unique
  // values for each event
  let jTokenStats = updateCommonJTokenStats(
    market.id,
    market.symbol,
    accountID,
    event.transaction.hash,
    event.block.timestamp,
    event.block.number,
    event.logIndex,
  )

  let borrowAmountBD = event.params.borrowAmount
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))

  jTokenStats.storedBorrowBalance = event.params.accountBorrows
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))
    .truncate(market.underlyingDecimals)
  jTokenStats.borrowBalanceUnderlying = jTokenStats.storedBorrowBalance
    .times(market.borrowIndex)
    .div(jTokenStats.accountBorrowIndex)

  jTokenStats.accountBorrowIndex = market.borrowIndex
  jTokenStats.totalUnderlyingBorrowed = jTokenStats.totalUnderlyingBorrowed.plus(
    borrowAmountBD,
  )
  jTokenStats.lifetimeBorrowInterestAccrued = jTokenStats.borrowBalanceUnderlying
    .minus(jTokenStats.totalUnderlyingBorrowed)
    .plus(jTokenStats.totalUnderlyingRepaid)
  jTokenStats.save()

  const joeLensContract = JoeLens.bind(Address.fromString(JOELENS_ADDRESS))
  const accountLimitInfoResult = joeLensContract.try_getAccountLimits(
    Address.fromString(JOETROLLER_ADDRESS),
    Address.fromString(accountID),
  )
  if (!accountLimitInfoResult.reverted) {
    account.totalCollateralValueInUSD = accountLimitInfoResult.value.totalCollateralValueUSD
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)
    account.totalBorrowValueInUSD = accountLimitInfoResult.value.totalBorrowValueUSD
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)
    account.health = accountLimitInfoResult.value.healthFactor
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)
    account.save()
  }

  let borrowID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  let borrowAmount = event.params.borrowAmount
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))
    .truncate(market.underlyingDecimals)

  let accountBorrows = event.params.accountBorrows
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))
    .truncate(market.underlyingDecimals)

  let borrow = new BorrowEvent(borrowID)
  borrow.amount = borrowAmount
  borrow.accountBorrows = accountBorrows
  borrow.borrower = event.params.borrower
  borrow.blockNumber = event.block.number.toI32()
  borrow.blockTime = event.block.timestamp.toI32()
  borrow.underlyingSymbol = market.underlyingSymbol
  borrow.save()
}

/* Repay some amount borrowed. Anyone can repay anyones balance
 *
 * event.params.totalBorrows = of the whole market (not used right now)
 * event.params.accountBorrows = total of the account (not used right now)
 * event.params.repayAmount = that was added in this event
 * event.params.borrower = the borrower
 * event.params.payer = the payer
 *
 * Notes
 *    No need to updateMarket(), handleAccrueInterest() ALWAYS runs before this
 *    Once a account totally repays a borrow, it still has its account interest index set to the
 *    markets value. We keep this, even though you might think it would reset to 0 upon full
 *    repay.
 */
export function handleRepayBorrow(event: RepayBorrow): void {
  let market = Market.load(event.address.toHexString())
  let accountID = event.params.borrower.toHex()
  let account = Account.load(accountID)
  if (account == null) {
    account = createAccount(accountID)
  }

  // Update jTokenStats common for all events, and return the stats to update unique
  // values for each event
  let jTokenStats = updateCommonJTokenStats(
    market.id,
    market.symbol,
    accountID,
    event.transaction.hash,
    event.block.timestamp,
    event.block.number,
    event.logIndex,
  )

  let repayAmountBD = event.params.repayAmount
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))
  let repayAmountUSD = repayAmountBD.times(market.underlyingPriceUSD)

  jTokenStats.storedBorrowBalance = event.params.accountBorrows
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))
    .truncate(market.underlyingDecimals)
  jTokenStats.borrowBalanceUnderlying = jTokenStats.storedBorrowBalance
    .times(market.borrowIndex)
    .div(jTokenStats.accountBorrowIndex)

  const joeLensContract = JoeLens.bind(Address.fromString(JOELENS_ADDRESS))
  const accountLimitInfoResult = joeLensContract.try_getAccountLimits(
    Address.fromString(JOETROLLER_ADDRESS),
    Address.fromString(accountID),
  )
  if (!accountLimitInfoResult.reverted) {
    account.totalCollateralValueInUSD = accountLimitInfoResult.value.totalCollateralValueUSD
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)
    account.totalBorrowValueInUSD = accountLimitInfoResult.value.totalBorrowValueUSD
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)
    account.health = accountLimitInfoResult.value.healthFactor
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor)
    account.save()
  }

  jTokenStats.accountBorrowIndex = market.borrowIndex
  jTokenStats.totalUnderlyingRepaid = jTokenStats.totalUnderlyingRepaid.plus(
    repayAmountBD,
  )
  jTokenStats.lifetimeBorrowInterestAccrued = jTokenStats.borrowBalanceUnderlying
    .minus(jTokenStats.totalUnderlyingBorrowed)
    .plus(jTokenStats.totalUnderlyingRepaid)
  jTokenStats.save()

  let repayID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  let repayAmount = event.params.repayAmount
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))
    .truncate(market.underlyingDecimals)

  let accountBorrows = event.params.accountBorrows
    .toBigDecimal()
    .div(exponentToBigDecimal(market.underlyingDecimals))
    .truncate(market.underlyingDecimals)

  let repay = new RepayEvent(repayID)
  repay.amount = repayAmount
  repay.accountBorrows = accountBorrows
  repay.borrower = event.params.borrower
  repay.blockNumber = event.block.number.toI32()
  repay.blockTime = event.block.timestamp.toI32()
  repay.underlyingSymbol = market.underlyingSymbol
  repay.payer = event.params.payer
  repay.save()
}

/*
 * Liquidate an account who has fell below the collateral factor.
 *
 * event.params.borrower - the borrower who is getting liquidated of their jTokens
 * event.params.jTokenCollateral - the market ADDRESS of the ctoken being liquidated
 * event.params.liquidator - the liquidator
 * event.params.repayAmount - the amount of underlying to be repaid
 * event.params.seizeTokens - jTokens seized (transfer event should handle this)
 *
 * Notes
 *    No need to updateMarket(), handleAccrueInterest() ALWAYS runs before this.
 *    When calling this function, event RepayBorrow, and event Transfer will be called every
 *    time. This means we can ignore repayAmount. Seize tokens only changes state
 *    of the jTokens, which is covered by transfer. Therefore we only
 *    add liquidation counts in this handler.
 */
export function handleLiquidateBorrow(event: LiquidateBorrow): void {
  let liquidatorID = event.params.liquidator.toHex()
  let liquidator = Account.load(liquidatorID)
  if (liquidator == null) {
    liquidator = createAccount(liquidatorID)
  }
  liquidator.countLiquidator = liquidator.countLiquidator + 1
  liquidator.save()

  let borrowerID = event.params.borrower.toHex()
  let borrower = Account.load(borrowerID)
  if (borrower == null) {
    borrower = createAccount(borrowerID)
  }
  borrower.countLiquidated = borrower.countLiquidated + 1
  borrower.save()

  // For a liquidation, the liquidator pays down the borrow of the underlying
  // asset. They seize one of potentially many types of jToken collateral of
  // the underwater borrower. So we must get that address from the event, and
  // the repay token is the event.address
  let marketRepayToken = Market.load(event.address.toHexString())
  let marketJTokenLiquidated = Market.load(event.params.jTokenCollateral.toHexString())
  let mintID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  let jTokenAmount = event.params.seizeTokens
    .toBigDecimal()
    .div(jTokenDecimalsBD)
    .truncate(jTokenDecimals)
  let underlyingRepayAmount = event.params.repayAmount
    .toBigDecimal()
    .div(exponentToBigDecimal(marketRepayToken.underlyingDecimals))
    .truncate(marketRepayToken.underlyingDecimals)

  let liquidation = new LiquidationEvent(mintID)
  liquidation.amount = jTokenAmount
  liquidation.to = event.params.liquidator
  liquidation.from = event.params.borrower
  liquidation.blockNumber = event.block.number.toI32()
  liquidation.blockTime = event.block.timestamp.toI32()
  liquidation.underlyingSymbol = marketRepayToken.underlyingSymbol
  liquidation.underlyingRepayAmount = underlyingRepayAmount
  liquidation.jTokenSymbol = marketJTokenLiquidated.symbol
  liquidation.save()
}

/* Transferring of jTokens
 *
 * event.params.from = sender of jTokens
 * event.params.to = receiver of jTokens
 * event.params.amount = amount sent
 *
 * Notes
 *    Possible ways to emit Transfer:
 *      seize() - i.e. a Liquidation Transfer (does not emit anything else)
 *      redeemFresh() - i.e. redeeming your jTokens for underlying asset
 *      mintFresh() - i.e. you are lending underlying assets to create ctokens
 *      transfer() - i.e. a basic transfer
 *    This function handles all 4 cases. Transfer is emitted alongside the mint, redeem, and seize
 *    events. So for those events, we do not update jToken balances.
 */
export function handleTransfer(event: Transfer): void {
  // We don't updateMarket with normal transfers,
  // since mint, redeem, and seize transfers will already run updateMarket()
  let marketID = event.address.toHexString()
  let market = Market.load(marketID)

  let amountUnderlying = market.exchangeRate.times(
    event.params.amount.toBigDecimal().div(jTokenDecimalsBD),
  )
  let amountUnderylingTruncated = amountUnderlying.truncate(market.underlyingDecimals)

  // Checking if the tx is FROM the jToken contract (i.e. this will not run when minting)
  // If so, it is a mint, and we don't need to run these calculations
  let accountFromID = event.params.from.toHex()
  if (accountFromID != marketID) {
    let accountFrom = Account.load(accountFromID)
    if (accountFrom == null) {
      accountFrom = createAccount(accountFromID)
    }

    // Update jTokenStats common for all events, and return the stats to update unique
    // values for each event
    let jTokenStatsFrom = updateCommonJTokenStats(
      market.id,
      market.symbol,
      accountFromID,
      event.transaction.hash,
      event.block.timestamp,
      event.block.number,
      event.logIndex,
    )

    jTokenStatsFrom.totalUnderlyingRedeemed = jTokenStatsFrom.totalUnderlyingRedeemed.plus(
      amountUnderylingTruncated,
    )
    jTokenStatsFrom.supplyBalanceUnderlying = jTokenStatsFrom.jTokenBalance.times(
      market.exchangeRate,
    )
    jTokenStatsFrom.lifetimeSupplyInterestAccrued = jTokenStatsFrom.supplyBalanceUnderlying
      .minus(jTokenStatsFrom.totalUnderlyingSupplied)
      .plus(jTokenStatsFrom.totalUnderlyingRedeemed)
    jTokenStatsFrom.save()

    const joeLensContract = JoeLens.bind(Address.fromString(JOELENS_ADDRESS))
    const accountLimitInfoResult = joeLensContract.try_getAccountLimits(
      Address.fromString(JOETROLLER_ADDRESS),
      Address.fromString(accountFromID),
    )
    if (!accountLimitInfoResult.reverted) {
      accountFrom.totalCollateralValueInUSD = accountLimitInfoResult.value.totalCollateralValueUSD
        .toBigDecimal()
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)
      accountFrom.totalBorrowValueInUSD = accountLimitInfoResult.value.totalBorrowValueUSD
        .toBigDecimal()
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)
      accountFrom.health = accountLimitInfoResult.value.healthFactor
        .toBigDecimal()
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)
      accountFrom.save()
    }
  }

  // Checking if the tx is TO the jToken contract (i.e. this will not run when redeeming)
  // If so, we ignore it. this leaves an edge case, where someone who accidentally sends
  // jTokens to a jToken contract, where it will not get recorded. Right now it would
  // be messy to include, so we are leaving it out for now TODO fix this in future
  let accountToID = event.params.to.toHex()
  if (accountToID != marketID) {
    let accountTo = Account.load(accountToID)
    if (accountTo == null) {
      accountTo = createAccount(accountToID)
    }

    // Update jTokenStats common for all events, and return the stats to update unique
    // values for each event
    let jTokenStatsTo = updateCommonJTokenStats(
      market.id,
      market.symbol,
      accountToID,
      event.transaction.hash,
      event.block.timestamp,
      event.block.number,
      event.logIndex,
    )

    jTokenStatsTo.totalUnderlyingSupplied = jTokenStatsTo.totalUnderlyingSupplied.plus(
      amountUnderylingTruncated,
    )
    jTokenStatsTo.supplyBalanceUnderlying = jTokenStatsTo.jTokenBalance.times(
      market.exchangeRate,
    )
    jTokenStatsTo.lifetimeSupplyInterestAccrued = jTokenStatsTo.supplyBalanceUnderlying
      .minus(jTokenStatsTo.totalUnderlyingSupplied)
      .plus(jTokenStatsTo.totalUnderlyingRedeemed)
    jTokenStatsTo.save()

    const joeLensContract = JoeLens.bind(Address.fromString(JOELENS_ADDRESS))
    const accountLimitInfoResult = joeLensContract.try_getAccountLimits(
      Address.fromString(JOETROLLER_ADDRESS),
      Address.fromString(accountToID),
    )
    if (!accountLimitInfoResult.reverted) {
      accountTo.totalCollateralValueInUSD = accountLimitInfoResult.value.totalCollateralValueUSD
        .toBigDecimal()
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)
      accountTo.totalBorrowValueInUSD = accountLimitInfoResult.value.totalBorrowValueUSD
        .toBigDecimal()
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)
      accountTo.health = accountLimitInfoResult.value.healthFactor
        .toBigDecimal()
        .div(mantissaFactorBD)
        .truncate(mantissaFactor)
      accountTo.save()
    }
  }

  let transferID = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  let transfer = new TransferEvent(transferID)
  transfer.amount = event.params.amount.toBigDecimal().div(jTokenDecimalsBD)
  transfer.to = event.params.to
  transfer.from = event.params.from
  transfer.blockNumber = event.block.number.toI32()
  transfer.blockTime = event.block.timestamp.toI32()
  transfer.jTokenSymbol = market.symbol
  transfer.save()
}

export function handleAccrueInterest(event: AccrueInterest): void {
  updateMarket(event)
}

export function handleNewReserveFactor(event: NewReserveFactor): void {
  let marketID = event.address.toHex()
  let market = Market.load(marketID)
  market.reserveFactor = event.params.newReserveFactorMantissa
  market.save()
}

export function handleNewMarketInterestRateModel(
  event: NewMarketInterestRateModel,
): void {
  let marketID = event.address.toHex()
  let market = Market.load(marketID)
  if (market == null) {
    market = createMarket(marketID)
  }
  market.interestRateModelAddress = event.params.newInterestRateModel
  market.save()
}
