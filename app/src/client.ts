import * as anchor from '@coral-xyz/anchor';
import {
    Connection,
    Transaction,
    TransactionInstruction,
    Keypair,
    PublicKey,
    VersionedTransaction,
    TransactionMessage, ComputeBudgetProgram, SystemProgram
} from "@solana/web3.js";
import { Program } from '@coral-xyz/anchor';
import { Paymaster } from '../target/types/paymaster';
import { getConfigPda } from './utils';

// 初始化客户端
export async function initPaymasterClient(): Promise<Program<Paymaster>> {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    return anchor.workspace.Paymaster as Program<Paymaster>;
}

// 封装SOL代付调用
export async function solPay(
    program: Program<Paymaster>,
    user: Keypair,
    baseFee: number,
    paymasterRecv: PublicKey,
    authority: PublicKey
): Promise<string> {
    const [configPda] = getConfigPda(program.programId);

    return program.methods
        .solPay(baseFee)
        .accounts({
            config: configPda,
            user: user.publicKey,
            paymasterRecv,
            authority,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();
}

// 封装USDT代付调用
export async function usdtPay(
    program: Program<Paymaster>,
    user: Keypair,
    baseFee: number,
    solUsdtRate: number,
    userUsdt: PublicKey,
    paymasterUsdt: PublicKey,
    usdtMint: PublicKey,
    authority: PublicKey
): Promise<string> {
    const [configPda] = getConfigPda(program.programId);

    return program.methods
        .usdtPay(baseFee, solUsdtRate)
        .accounts({
            config: configPda,
            userUsdt,
            paymasterUsdt,
            usdtMint,
            user: user.publicKey,
            authority,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
}

/**
 * 用 getFeeForMessage (网络真实费率) + simulateTransaction (估算 CU) 来返回估算结果
 *
 * @param connection  - Solana connection
 * @param payer       - 用于编译 message 的 payer 公钥（不会真的签名/发送）
 * @param businessIxs - 业务指令数组
 * @param priceMicroLamports - 可选，simulate 时填入的 compute unit price（microLamports/ CU）
 *
 * @returns { feeLamports, computeUnits } - feeLamports 是 RPC 返回的网络手续费（lamports），computeUnits 为模拟得到的 CU（若 simulate 成功）
 */
export async function estimateNetworkFeeForIxs(
    connection: Connection,
    payer: PublicKey,
    businessIxs: TransactionInstruction[],
    priceMicroLamports = 1
): Promise<{ feeLamports: number; computeUnits?: number }> {
    // 1) 先拿 blockhash（用于编译 message）
    const { blockhash } = await connection.getLatestBlockhash();

    // 2) 为 message 加入一个 compute budget 设置（可选：让节点以特定 price 估算）
    const budgetIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priceMicroLamports,
    });

    // 注意：getFeeForMessage 接受的是单一 Message 的 base64 表示，
    // 我们将 businessIxs 放到一个 VersionedMessage 中（含 compute price）
    const instructions = [budgetIx, ...businessIxs];

    // 3) 构造 TransactionMessage 并编译为 v0 message
    const txMsg = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message();

    // 4) 序列化并 base64 编码 —— RPC 需要 base64 的 Message bytes
    const messageBytes = txMsg.serialize();
    const messageBase64 = Buffer.from(messageBytes).toString("base64");

    // 5) 调用 RPC getFeeForMessage
    // 返回结构一般为 { value: <lamports> }
    const feeResp = await connection.getFeeForMessage(txMsg);
    const feeLamports = (feeResp && (feeResp as any).value) ?? 0;

    // 6) 同时尝试 simulateTransaction 获取 computeUnitsConsumed（非必需，但对你内部计费有用）
    let computeUnits: number | undefined = undefined;
    try {
        // 构造一个短期模拟用的 VersionedTransaction（无需签名）
        const vtx = new VersionedTransaction(txMsg);
        // simulateTransaction 接受 VersionedTransaction 或已经签名的 raw tx
        const sim = await connection.simulateTransaction(vtx);
        // 在成功的情况下，sim.value.computeUnitsConsumed 可能存在（不同 RPC 返回名可能不同）
        computeUnits = (sim && (sim.value as any).unitsConsumed) ?? (sim && sim.value?.logs ? (sim.value as any).computeUnitsConsumed : undefined);
    } catch (e) {
        // 模拟失败也无需中断：我们仍有 getFeeForMessage 的结果
        // console.debug("simulateTransaction failed:", e);
    }

    return {
        feeLamports,
        computeUnits,
    };
}

/**
 * 构建并发送由 sponsor 代付的交易。
 * businessIxs 从外部传入；函数会：
 *  1) 用 getFeeForMessage 估算网络 fee（lamports）
 *  2) 把 estimate fee 作为 baseFee 传入 paymaster.solPay()
 *  3) 构造交易：compute budget (optional) + businessIxs + payIx
 *  4) user 签名 -> sponsor 签名 -> 发送
 */
export async function buildSponsoredTxWithNetworkFee(
    connection: Connection,
    program: Program<Paymaster>,
    user: Keypair,
    sponsor: Keypair,
    businessIxs: TransactionInstruction[],
    authority: PublicKey,
    extraServiceFeeLamports = 0 // 可选：平台想加的固定服务费（lamports）
): Promise<[Transaction, number]> {
    // 1) 自动估算网络费用（基于业务指令）
    const { feeLamports, computeUnits } = await estimateNetworkFeeForIxs(
        connection,
        user.publicKey,
        businessIxs,
        1 // price microLamports 可根据策略改动
    );

    console.log("feeLamports: ", feeLamports)

    // 2) 由网络费 + 平台额外费用 组成最终 baseFee
    const baseFee = Math.max(0, feeLamports + extraServiceFeeLamports);

    // 3) 取得 config PDA（假设你有 getConfigPda）
    const [configPda] = getConfigPda(program.programId);

    // 4) 构造 paymaster 指令（替代你直接传 baseFee 的做法）
    const payIx = await program.methods
        .solPay(new anchor.BN(baseFee))
        .accounts({
            config: configPda,
            user: user.publicKey,
            paymasterRecv: sponsor.publicKey,
            authority,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

    // 5) 可选：根据 computeUnits 决定 setComputeUnitLimit
    const budgetIxs = [];
    // if (computeUnits) {
    //     // 给一个 margin（+10%）
    //     const limit = Math.ceil(computeUnits * 1.1);
    //     budgetIxs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: limit }));
    //     budgetIxs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }));
    // } else {
    //     // 默认值（保守）
    //     budgetIxs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
    //     budgetIxs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }));
    // }

    // 6) 构造最终交易（顺序：budget -> business -> pay）
    const tx = new Transaction().add(...budgetIxs, ...businessIxs, payIx);

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = sponsor.publicKey;

    // 7) user 签名（业务相关 signer）
    tx.partialSign(user);
    console.log("user: ", user.publicKey);

    // 8) sponsor 签名（fee payer）
    tx.partialSign(sponsor);
    console.log("sponsor: ", sponsor.publicKey);


    return [tx, baseFee];
}

// 示例调用
async function main() {
}

// main(); // 取消注释运行