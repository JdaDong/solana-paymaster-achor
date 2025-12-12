#!/bin/bash

anchor clean && anchor build && solana program deploy ./target/deploy/paymaster.so --url localhost:8899





