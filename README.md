# Banker Joe Lending Subgraph

Lending subgraph forked from `CREAM`(https://cream.finance), a money markets lending protocol on Ethereum/Polygon blockchain.

**Key changes:**

- We add modifications to per-sec based instead of per-block based calculations.
- Add deployment configs for `Rinkeby` and `Avalanche`

## Hosted Service

The subgraph will available via TheGraph hosted service. We will migrate to decentralized mainnet when Avalanche support is available.

- Subgraph explorer: https://thegraph.com/legacy-explorer/subgraph/traderjoe-xyz/lending
- Subgraph API: https://api.thegraph.com/subgraphs/name/traderjoe-xyz/lending

## ABI

TBD

## Deploy

```
# authenticate api key
$ graph auth https://api.thegraph.com/deploy/ <API_KEY>

# deploy rinkeby
$ yarn codegen:rinkeby; yarn build:rinkeby; yarn deploy:rinkeby

# deploy avax
$ yarn codegen:avax; yarn build:avax; yarn deploy:avax
```
