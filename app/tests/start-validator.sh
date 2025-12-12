#!/bin/bash

DIRECTORY=$(dirname "$0")

# Start the validator

solana-test-validator --ledger $DIRECTORY/test-ledger \
    --url mainnet-beta \
    --reset

solana airdrop 1000 $(solana address) --url localhost:8899

# 验证余额（应显示 1000 SOL）
solana balance --url localhost:8899
