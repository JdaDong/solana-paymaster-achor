use anchor_lang::{prelude::*, system_program};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use std::ops::Add;

// 程序ID（由Anchor自动生成，Anchor.toml中配置）
declare_id!("6DhkLufYgd7G6K78eXQ5MD5N4pV7qFCQga17xivdtxKY");

#[program]
pub mod paymaster {
    use super::*;

    /// 初始化代付配置账户
    pub fn initialize(
        ctx: Context<Initialize>,
        service_fee_rate: u64, // 服务费费率（万分比，100=1%）
        supported_tokens: Vec<Pubkey>, // 支持的代币Mint（USDT等）
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        // 初始化配置
        config.authority = ctx.accounts.authority.key();
        config.service_fee_rate = service_fee_rate;
        config.supported_tokens = supported_tokens;
        config.bump = ctx.bumps.config;

        msg!("Paymaster config initialized: authority={}, fee_rate={}", config.authority, config.service_fee_rate);
        Ok(())
    }

    /// SOL代付核心指令
    pub fn sol_pay(
        ctx: Context<SolPay>,
        base_fee: u64, // 基础Gas费（lamports）
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        // 计算总费用（基础费 + 服务费）
        let service_fee = base_fee.checked_mul(config.service_fee_rate).unwrap() / 10000;
        let total_fee = base_fee.add(service_fee);

        // 验证用户余额
        if ctx.accounts.user.lamports() < total_fee {
            return err!(PaymasterError::InsufficientFunds);
        }

        // SOL转账：用户 → 代付方收款账户
        let transfer_instr = anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.paymaster_recv.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instr,
        );
        anchor_lang::system_program::transfer(cpi_ctx, total_fee)?;

        msg!("SOL pay success: user={}, total_fee={} lamports", ctx.accounts.user.key(), total_fee);
        Ok(())
    }

    /// USDT代付核心指令（SPL Token）
    pub fn usdt_pay(
        ctx: Context<UsdtPay>,
        base_fee: u64, // 基础Gas费（lamports，SOL计价）
        sol_usdt_rate: u64, // SOL/USDT汇率（万分比，1000000=1 SOL=100 USDT）
    ) -> Result<()> {
        let config = &ctx.accounts.config;

        // 验证USDT是否支持
        if !config.supported_tokens.contains(&ctx.accounts.usdt_mint.key()) {
            return err!(PaymasterError::UnsupportedToken);
        }

        // 计算总费用（SOL → USDT）
        let service_fee_sol = base_fee.checked_mul(config.service_fee_rate).unwrap() / 10000;
        let total_fee_sol = base_fee.add(service_fee_sol);
        // 转换为USDT最小单位（6位小数）
        let total_fee_usdt = total_fee_sol
            .checked_mul(sol_usdt_rate)
            .unwrap()
            / 10000
            * 10u64.pow(6);

        // USDT转账：用户 → 代付方收款账户
        let transfer_instr = Transfer {
            from: ctx.accounts.user_usdt.to_account_info(),
            to: ctx.accounts.paymaster_usdt.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_instr,
        );
        token::transfer(cpi_ctx, total_fee_usdt)?;

        msg!("USDT pay success: user={}, total_fee={} USDT", ctx.accounts.user.key(), total_fee_usdt / 10u64.pow(6));
        Ok(())
    }
}

/// 账户结构体定义
#[account]
#[derive(Default)]
pub struct PaymasterConfig {
    /// 代付方权限账户
    pub authority: Pubkey,
    /// 服务费费率（万分比）
    pub service_fee_rate: u64,
    /// 支持的代币Mint列表
    pub supported_tokens: Vec<Pubkey>,
    /// PDA bump值
    pub bump: u8,
}

/// 指令上下文定义
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// 代付配置账户（PDA）
    #[account(
        init,
        seeds = [b"paymaster_config".as_ref()],
        bump,
        payer = authority,
        space = 8 + 32 + 8 + 4 + (32 * 10) + 1 // 最大支持10个代币
    )]
    pub config: Account<'info, PaymasterConfig>,

    /// 代付方权限账户（签名）
    #[account(mut)]
    pub authority: Signer<'info>,

    /// 系统程序
    pub system_program: Program<'info, System>,

    /// 租金Sysvar
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SolPay<'info> {
    /// 代付配置账户（只读）
    #[account(
        seeds = [b"paymaster_config".as_ref()],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, PaymasterConfig>,

    /// 用户账户（付款，签名）
    /// CHECK:
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: 
    #[account(mut, constraint = paymaster_recv.owner == &system_program::ID)]
    pub paymaster_recv: AccountInfo<'info>,

    /// 代付方权限账户（只读）
    /// CHECK:
    pub authority: AccountInfo<'info>,

    /// 系统程序
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UsdtPay<'info> {
    /// 代付配置账户（只读）
    #[account(
        seeds = [b"paymaster_config".as_ref()],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, PaymasterConfig>,

    /// 用户USDT账户（付款）
    #[account(mut)]
    pub user_usdt: Account<'info, TokenAccount>,

    /// 代付方USDT收款账户
    #[account(mut)]
    pub paymaster_usdt: Account<'info, TokenAccount>,

    /// USDT Mint账户
    /// CHECK: Mint is only read for address comparison, no data read.
    pub usdt_mint: Account<'info, Mint>,

    /// 用户主账户（签名）
    /// CHECK:
    #[account(mut)]
    pub user: Signer<'info>,

    /// 代付方权限账户（只读）
    /// CHECK:
    pub authority: AccountInfo<'info>,

    /// Token程序
    pub token_program: Program<'info, Token>,
}

/// 自定义错误类型
#[error_code]
pub enum PaymasterError {
    #[msg("Insufficient funds for payment")]
    InsufficientFunds,

    #[msg("Unsupported token for payment")]
    UnsupportedToken,

    #[msg("Invalid authority for paymaster")]
    InvalidAuthority,

    #[msg("Config account not initialized")]
    ConfigNotInitialized,
}