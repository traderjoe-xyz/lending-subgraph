/* eslint-disable prefer-const */ // to satisfy AS compiler

// For each division by 10, add one to exponent to truncate one significant figure
import { BigDecimal, BigInt, Bytes, Address } from '@graphprotocol/graph-ts'
import { AccountJToken, Account, AccountJTokenTransaction } from '../types/schema'

export function exponentToBigDecimal(decimals: i32): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = 0; i < decimals; i++) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export let mantissaFactor = 18
export let jTokenDecimals = 8
export let mantissaFactorBD: BigDecimal = exponentToBigDecimal(18)
export let jTokenDecimalsBD: BigDecimal = exponentToBigDecimal(8)
export let zeroBD = BigDecimal.fromString('0')

export function createAccountJToken(
  jTokenStatsID: string,
  symbol: string,
  account: string,
  marketID: string,
): AccountJToken {
  let jTokenStats = new AccountJToken(jTokenStatsID)
  jTokenStats.symbol = symbol
  jTokenStats.market = marketID
  jTokenStats.account = account
  jTokenStats.accrualBlockTimestamp = BigInt.fromI32(0)
  jTokenStats.jTokenBalance = zeroBD
  jTokenStats.totalUnderlyingSupplied = zeroBD
  jTokenStats.totalUnderlyingRedeemed = zeroBD
  jTokenStats.accountBorrowIndex = zeroBD
  jTokenStats.totalUnderlyingBorrowed = zeroBD
  jTokenStats.totalUnderlyingRepaid = zeroBD
  jTokenStats.storedBorrowBalance = zeroBD
  jTokenStats.enteredMarket = false
  return jTokenStats
}

export function createAccount(accountID: string): Account {
  let account = new Account(accountID)
  account.countLiquidated = 0
  account.countLiquidator = 0
  account.hasBorrowed = false
  account.health = zeroBD
  account.totalBorrowValueInUSD = zeroBD
  account.totalCollateralValueInUSD = zeroBD
  account.save()
  return account
}

export function updateCommonJTokenStats(
  marketID: string,
  marketSymbol: string,
  accountID: string,
  tx_hash: Bytes,
  timestamp: BigInt,
  blockNumber: BigInt,
  logIndex: BigInt,
): AccountJToken {
  let jTokenStatsID = marketID.concat('-').concat(accountID)
  let jTokenStats = AccountJToken.load(jTokenStatsID)
  if (jTokenStats == null) {
    jTokenStats = createAccountJToken(jTokenStatsID, marketSymbol, accountID, marketID)
  }
  getOrCreateAccountJTokenTransaction(
    jTokenStatsID,
    tx_hash,
    timestamp,
    blockNumber,
    logIndex,
  )
  jTokenStats.accrualBlockTimestamp = timestamp
  return jTokenStats as AccountJToken
}

export function getOrCreateAccountJTokenTransaction(
  accountID: string,
  tx_hash: Bytes,
  timestamp: BigInt,
  block: BigInt,
  logIndex: BigInt,
): AccountJTokenTransaction {
  let id = accountID
    .concat('-')
    .concat(tx_hash.toHexString())
    .concat('-')
    .concat(logIndex.toString())
  let transaction = AccountJTokenTransaction.load(id)

  if (transaction == null) {
    transaction = new AccountJTokenTransaction(id)
    transaction.account = accountID
    transaction.tx_hash = tx_hash
    transaction.timestamp = timestamp
    transaction.block = block
    transaction.logIndex = logIndex
    transaction.save()
  }

  return transaction as AccountJTokenTransaction
}
