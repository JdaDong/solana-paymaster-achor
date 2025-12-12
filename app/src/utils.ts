import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createMint, createAccount, mintTo, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';

/**
 * 创建测试用USDT Mint（6位小数）
 */
export async function createTestUsdtMint(
    provider: anchor.Provider,
    mintAuthority: Keypair
): Promise<PublicKey> {
    return createMint(
        provider.connection,
        mintAuthority,
        mintAuthority.publicKey,
        null,
        6,
        Keypair.generate(),
        {},
        TOKEN_PROGRAM_ID
    );
}

/**
 * 创建Token账户并Mint USDT
 */
export async function createUsdtAccount(
    provider: anchor.Provider,
    mint: PublicKey,
    owner: Keypair,
    amount: number // 实际USDT数量（如10=10 USDT）
): Promise<PublicKey> {
    // 创建Token账户
    const tokenAccount = await createAccount(
        provider.connection,
        owner,
        mint,
        owner.publicKey,
        Keypair.generate(),
        {},
        TOKEN_PROGRAM_ID
    );

    console.log("tokenAccount: ", tokenAccount)

    // Mint USDT（转换为最小单位）
    await mintTo(
        provider.connection,
        owner,
        mint,
        tokenAccount,
        owner,
        BigInt(amount * Math.pow(10, 6)),
        [],
        {},
        TOKEN_PROGRAM_ID
    );

    return tokenAccount;
}

/**
 * 获取PDA（Paymaster配置账户）
 */
export function getConfigPda(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('paymaster_config')],
        programId
    );
}

/**
 * 打印账户余额
 */
export async function printBalances(
    provider: anchor.Provider,
    user: Keypair,
    paymasterRecv: PublicKey,
    userUsdt?: PublicKey,
    paymasterUsdt?: PublicKey
) {
    // SOL余额
    const userSol = await provider.connection.getBalance(user.publicKey);
    const paymasterSol = await provider.connection.getBalance(paymasterRecv);
    console.log(`👤 用户SOL余额: ${userSol / LAMPORTS_PER_SOL} SOL`);
    console.log(`💰 代付方SOL余额: ${paymasterSol / LAMPORTS_PER_SOL} SOL`);

    // USDT余额
    if (userUsdt && paymasterUsdt) {
        const userUsdtInfo = await getAccount(provider.connection, userUsdt);
        const paymasterUsdtInfo = await getAccount(provider.connection, paymasterUsdt);
        console.log(`👤 用户USDT余额: ${Number(userUsdtInfo.amount) / Math.pow(10, 6)} USDT`);
        console.log(`💰 代付方USDT余额: ${Number(paymasterUsdtInfo.amount) / Math.pow(10, 6)} USDT`);
    }
}