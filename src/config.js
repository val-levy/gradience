window.PERPS_CONFIG = {
  "address": "0x5b3A5751eB6a74636Ae647C0F63D098D8fF4C1F7",
  "chainId": 10143,
  "deployBlock": 80080660,
  "rpcUrl": "https://testnet-rpc.monad.xyz",
  "owner": "0x3D559dD65b48AAbF238d2FAB5640a38a97be600f",
  "abi": [
    {
      "type": "constructor",
      "inputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "DOMAIN_SEPARATOR",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "GRACE",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "MAX_PRICE",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "MIN_PRICE",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "ONE",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "UPDATE_TYPEHASH",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "claim",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "claimable",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "closePosition",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "createMarket",
      "inputs": [
        {
          "name": "name",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "expiry",
          "type": "uint64",
          "internalType": "uint64"
        },
        {
          "name": "initialPrice",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "oiCap",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "skewFactor",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "fundingPerDay",
          "type": "uint128",
          "internalType": "uint128"
        }
      ],
      "outputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "depositHouse",
      "inputs": [],
      "outputs": [],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "feeBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "houseBalance",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isSigner",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "liqRewardBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "liquidate",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "maintBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "markPrice",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "marketCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "markets",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "name",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "expiry",
          "type": "uint64",
          "internalType": "uint64"
        },
        {
          "name": "priceTime",
          "type": "uint64",
          "internalType": "uint64"
        },
        {
          "name": "settled",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "indexPrice",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "settlePrice",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "longOI",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "shortOI",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "oiCap",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "skewFactor",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "fundingPerDay",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "fundingTime",
          "type": "uint64",
          "internalType": "uint64"
        },
        {
          "name": "cumFunding",
          "type": "int256",
          "internalType": "int256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "maxLeverage",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "maxStale",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "netDeposited",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "int256",
          "internalType": "int256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "openPosition",
      "inputs": [
        {
          "name": "marketId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "isLong",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "leverage",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "limitPrice",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "positionCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "positionHealth",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "pnl",
          "type": "int256",
          "internalType": "int256"
        },
        {
          "name": "funding",
          "type": "int256",
          "internalType": "int256"
        },
        {
          "name": "equity",
          "type": "int256",
          "internalType": "int256"
        },
        {
          "name": "liquidatable",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "positions",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "trader",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "marketId",
          "type": "uint32",
          "internalType": "uint32"
        },
        {
          "name": "isLong",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "open",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "collateral",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "notional",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "entryPrice",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "maxProfit",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "fundingEntry",
          "type": "int256",
          "internalType": "int256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "quorum",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "reserved",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "setMarketParams",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "oiCap",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "skewFactor",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "fundingPerDay",
          "type": "uint128",
          "internalType": "uint128"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setParams",
      "inputs": [
        {
          "name": "fee",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "maint",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "liqReward",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "maxLev",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "stale",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setQuorum",
      "inputs": [
        {
          "name": "q",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setSigner",
      "inputs": [
        {
          "name": "s",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "on",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "signerCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "transferOwnership",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "updatePrice",
      "inputs": [
        {
          "name": "marketId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "ups",
          "type": "tuple[]",
          "internalType": "struct PredictionPerps.SignedPrice[]",
          "components": [
            {
              "name": "price",
              "type": "uint128",
              "internalType": "uint128"
            },
            {
              "name": "timestamp",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "finalized",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "sig",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "userPositionIds",
      "inputs": [
        {
          "name": "a",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "withdrawHouse",
      "inputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "HouseDeposit",
      "inputs": [
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "HouseWithdraw",
      "inputs": [
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "MarketCreated",
      "inputs": [
        {
          "name": "marketId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "name",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        },
        {
          "name": "expiry",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        },
        {
          "name": "indexPrice",
          "type": "uint128",
          "indexed": false,
          "internalType": "uint128"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "MarketSettled",
      "inputs": [
        {
          "name": "marketId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "settlePrice",
          "type": "uint128",
          "indexed": false,
          "internalType": "uint128"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PositionClosed",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "marketId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "trader",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "payout",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "houseDelta",
          "type": "int256",
          "indexed": false,
          "internalType": "int256"
        },
        {
          "name": "reason",
          "type": "uint8",
          "indexed": false,
          "internalType": "uint8"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PositionOpened",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "marketId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "trader",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "isLong",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        },
        {
          "name": "collateral",
          "type": "uint128",
          "indexed": false,
          "internalType": "uint128"
        },
        {
          "name": "notional",
          "type": "uint128",
          "indexed": false,
          "internalType": "uint128"
        },
        {
          "name": "entryPrice",
          "type": "uint128",
          "indexed": false,
          "internalType": "uint128"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PriceUpdated",
      "inputs": [
        {
          "name": "marketId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "price",
          "type": "uint128",
          "indexed": false,
          "internalType": "uint128"
        },
        {
          "name": "timestamp",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    }
  ]
};
