#!/bin/bash

DIRECTORY=$(dirname "$0")

# Start the validator

solana-test-validator --ledger $DIRECTORY/test-ledger \
    --account-dir $DIRECTORY/accounts/orca \
    --account-dir $DIRECTORY/accounts/raydium/amm \
    --account-dir $DIRECTORY/accounts/raydium/clmm \
    --account-dir $DIRECTORY/accounts/heaven/amm \
    --account-dir $DIRECTORY/accounts/raydium/cp-swap \
    --account-dir $DIRECTORY/accounts/raydium/launchlab \
    --account-dir $DIRECTORY/accounts/pump \
    --account-dir $DIRECTORY/accounts/route-swap \
    --account-dir $DIRECTORY/accounts/meteora/dynamic-amm \
    --account-dir $DIRECTORY/accounts/meteora/dynamic-amm-v2 \
    --account-dir $DIRECTORY/accounts/meteora/dlmm \
    --account-dir $DIRECTORY/accounts/pump-amm \
    --account-dir $DIRECTORY/accounts/meteora/dbc \
    --bpf-program whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc $DIRECTORY/program/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc.so \
    --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s $DIRECTORY/program/metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s.so \
    --bpf-program CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK $DIRECTORY/program/CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK.so \
    --bpf-program CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C $DIRECTORY/program/CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C.so \
    --bpf-program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P $DIRECTORY/program/6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P.so \
    --bpf-program MaestroAAe9ge5HTc64VbBQZ6fP77pwvrhM8i1XWSAx $DIRECTORY/program/MaestroAAe9ge5HTc64VbBQZ6fP77pwvrhM8i1XWSAx.so \
    --bpf-program 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8 $DIRECTORY/program/675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8.so \
    --bpf-program LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo $DIRECTORY/program/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo.so \
    --bpf-program 24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi $DIRECTORY/program/24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi.so \
    --bpf-program Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB $DIRECTORY/program/Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB.so \
    --bpf-program pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA $DIRECTORY/program/pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA.so \
    --bpf-program cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG $DIRECTORY/program/cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG.so \
    --bpf-program dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN $DIRECTORY/program/dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN.so \
    --bpf-program LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj $DIRECTORY/program/LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj.so \
    --bpf-program HEAVENoP2qxoeuF8Dj2oT1GHEnu49U5mJYkdeC8BAX2o $DIRECTORY/program/HEAVENoP2qxoeuF8Dj2oT1GHEnu49U5mJYkdeC8BAX2o.so \
    --bpf-program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny $DIRECTORY/program/HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny.so \
    --bpf-program pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ $DIRECTORY/program/pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ.so \
    --url mainnet-beta \
    --reset