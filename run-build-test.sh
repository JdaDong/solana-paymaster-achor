#!/bin/bash
#
anchor clean && anchor build && anchor deploy --provider.cluster localnet &&  anchor test --skip-local-validator


