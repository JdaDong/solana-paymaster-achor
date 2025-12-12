import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { expect } from 'chai';
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { Paymaster } from '../target/types/paymaster';
import { createTestUsdtMint, createUsdtAccount, getConfigPda, printBalances } from '../src/utils';
import {buildSponsoredTxWithNetworkFee} from "../src/client";

// 初始化Anchor
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.Paymaster as Program<Paymaster>;

//  打开program的日志
anchor.AnchorProvider.env().connection.onLogs(
    program.programId,
    (logs) => console.log(logs),
    "confirmed"
);

// 测试账户
let paymasterAuthority: Keypair;
let user: Keypair;
let paymasterRecvSol: Keypair;
let usdtMint: PublicKey;
let userUsdt: PublicKey;
let paymasterUsdt: PublicKey;
let [configPda, configBump] = getConfigPda(program.programId);

describe('Solana Paymaster (Anchor)', () => {
    // 前置条件：初始化测试账户和环境
    before(async () => {
        // 生成测试账户
        paymasterAuthority = Keypair.generate();
        user = Keypair.generate();
        paymasterRecvSol = Keypair.generate();

        // 空投SOL
        await provider.connection.requestAirdrop(paymasterAuthority.publicKey, 20000 * LAMPORTS_PER_SOL);
        await provider.connection.requestAirdrop(user.publicKey, 10000  * LAMPORTS_PER_SOL);
        await provider.connection.requestAirdrop(paymasterRecvSol.publicKey, 1000 * LAMPORTS_PER_SOL);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 创建测试USDT Mint和Token账户
        console.log("waitig");
        usdtMint = await createTestUsdtMint(provider, paymasterAuthority);
        // userUsdt = await createUsdtAccount(provider, usdtMint, user, 10); // 用户10 USDT
        // paymasterUsdt = await createUsdtAccount(provider, usdtMint, paymasterAuthority, 0); // 代付方USDT账户
        console.log("waitig end");
    });

    // 测试1：初始化代付配置
    it('Initialize paymaster config', async () => {
        console.log("system: ", anchor.web3.SystemProgram.programId);
        console.log("rent: ", anchor.web3.SYSVAR_RENT_PUBKEY);
        const tx = await program.methods
            .initialize(new anchor.BN(100), [usdtMint]) // 1%服务费，支持USDT
            .accounts({
                config: configPda,
                authority: paymasterAuthority.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([paymasterAuthority])
            .rpc();

        console.log(`✅ 初始化配置交易: ${tx}`);

        // 验证配置账户
        const config = await program.account.paymasterConfig.fetch(configPda);
        expect(config.authority.toString()).to.equal(paymasterAuthority.publicKey.toString());
        // expect(config.serviceFeeRate).to.equal(new anchor.BN(100));
        // expect(config.supportedTokens[0].toString()).to.equal(usdtMint.toString());
        // expect(config.bump).to.equal(configBump);
    });

    // 测试2：SOL代付
    it('SOL paymaster', async () => {

        // 接收方
        const receiver = Keypair.generate().publicKey;

// 构造转账指令
        const transferInstruction = SystemProgram.transfer({
            fromPubkey: user.publicKey,    // 发送方地址
            toPubkey: receiver,              // 接收方地址
            lamports: LAMPORTS_PER_SOL * 1, // 转账金额（01 SOL）
        });


        // 代付前余额
        await printBalances(provider, user, paymasterRecvSol.publicKey);

        const userBalBefore = await provider.connection.getBalance(user.publicKey);
        const paymasterBalBefore = await provider.connection.getBalance(paymasterRecvSol.publicKey);
        const receiveBalBefore = await provider.connection.getBalance(receiver);

        // 执行SOL代付

        const [transaction, totalFee] = await buildSponsoredTxWithNetworkFee(
            provider.connection,
            program,
            user,
            paymasterRecvSol,
            [transferInstruction],
            paymasterAuthority.publicKey
        )

        const signature = await provider.connection.sendRawTransaction(transaction.serialize());
        console.log("signature: ", signature);

        // 等待确认（使用最新的确认方法）
        const latestBlockHash = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction(
            {
                signature: signature,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            },
            "finalized" // 确认级别，可以是 "processed" | "confirmed" | "finalized"
        );

        console.log("Transaction confirmed:", signature);



        console.log(`✅ SOL代付交易: ${transaction}`);

        // 验证余额变化
        const userBalAfter = await provider.connection.getBalance(user.publicKey);
        const paymasterBalAfter = await provider.connection.getBalance(paymasterRecvSol.publicKey);
        const receiveBalAfter = await provider.connection.getBalance(receiver);
        expect(receiveBalAfter - receiveBalBefore).to.equal(1 * LAMPORTS_PER_SOL)
        expect(userBalBefore - userBalAfter).to.equal(1 * LAMPORTS_PER_SOL - totalFee);
        expect(paymasterBalAfter- paymasterBalBefore).to.equal( totalFee);

        // 代付后余额
        await printBalances(provider, user, paymasterRecvSol.publicKey);
    });

    // 测试3：USDT代付
    // it('USDT paymaster', async () => {
    //     const baseFee = 5000; // 基础Gas费：5000 lamports
    //     const solUsdtRate = 1000000; // 1 SOL = 100 USDT
    //     const serviceFeeSol = Math.floor(baseFee * 100 / 10000);
    //     const totalFeeSol = baseFee + serviceFeeSol;
    //     const totalFeeUsdt = (totalFeeSol * solUsdtRate) / 10000;
    //
    //     // 代付前余额
    //     await printBalances(provider, user, paymasterRecvSol.publicKey, userUsdt, paymasterUsdt);
    //
    //     // 执行USDT代付
    //     const tx = await program.methods
    //         .usdtPay(baseFee, solUsdtRate)
    //         .accounts({
    //             config: configPda,
    //             userUsdt: userUsdt,
    //             paymasterUsdt: paymasterUsdt,
    //             usdtMint: usdtMint,
    //             user: user.publicKey,
    //             authority: paymasterAuthority.publicKey,
    //             tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    //         })
    //         .signers([user])
    //         .rpc();
    //
    //     console.log(`✅ USDT代付交易: ${tx}`);
    //
    //     // 验证USDT余额变化
    //     const userUsdtAfter = await getAccount(provider.connection, userUsdt);
    //     const paymasterUsdtAfter = await getAccount(provider.connection, paymasterUsdt);
    //     expect(Number(userUsdtAfter.amount)).to.equal(10 * Math.pow(10, 6) - totalFeeUsdt);
    //     expect(Number(paymasterUsdtAfter.amount)).to.equal(totalFeeUsdt);
    //
    //     // 代付后余额
    //     await printBalances(provider, user, paymasterRecvSol.publicKey, userUsdt, paymasterUsdt);
    // });
    //
    // // 测试4：SOL余额不足（异常场景）
    // it('SOL pay - insufficient funds', async () => {
    //     const baseFee = 2 * LAMPORTS_PER_SOL; // 超高费用（用户余额不足）
    //
    //     try {
    //         await program.methods
    //             .solPay(baseFee)
    //             .accounts({
    //                 config: configPda,
    //                 user: user.publicKey,
    //                 paymasterRecv: paymasterRecvSol.publicKey,
    //                 authority: paymasterAuthority.publicKey,
    //                 systemProgram: anchor.web3.SystemProgram.programId,
    //             })
    //             .signers([user])
    //             .rpc();
    //         expect.fail('交易应失败');
    //     } catch (err) {
    //         expect((err as Error).message).to.include('InsufficientFunds');
    //         console.log('✅ 余额不足测试通过');
    //     }
    // });
    // 测试5：更新费率
    // it('Update fee rate', async () => {
    //     const newFeeRate = 200; // 2%
    //
    //     // 执行更新
    //     const tx = await program.methods
    //         .updateFeeRate(newFeeRate)
    //         .accounts({
    //             config: configPda,
    //             authority: paymasterAuthority.publicKey,
    //         })
    //         .signers([paymasterAuthority])
    //         .rpc();
    //
    //     console.log(`✅ 更新费率交易: ${tx}`);
    //
    //     // 验证更新
    //     const config = await program.account.paymasterConfig.fetch(configPda);
    //     expect(config.serviceFeeRate).to.equal(newFeeRate);
    // });
});