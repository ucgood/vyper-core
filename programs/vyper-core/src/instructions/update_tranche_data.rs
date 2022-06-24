use crate::state::TrancheConfig;
use anchor_lang::prelude::*;

bitflags::bitflags! {
    struct UpdateTrancheConfigFlags: u16 {
        const HALT_FLAGS = 1 << 0;
        const RESERVE_FAIR_VALUE_STALE_SLOT_THRESHOLD = 1 << 1;
        const TRANCHE_FAIR_VALUE_STALE_SLOT_THRESHOLD = 1 << 2;
    }
}

#[derive(Accounts)]
pub struct UpdateTrancheDataContext<'info> {
    pub owner: Signer<'info>,

    /// Tranche config account, where all the parameters are saved
    #[account(mut, has_one = owner)]
    pub tranche_config: Box<Account<'info, TrancheConfig>>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Clone)]
pub struct UpdateTrancheDataInput {
    pub bitmask: u16,
    pub halt_flags: u16,
    pub reserve_fair_value_stale_slot_threshold: u64,
    pub tranche_fair_value_stale_slot_threshold: u64,
}

impl UpdateTrancheDataInput {
    fn get_update_tranche_bitmask(&self) -> Option<UpdateTrancheConfigFlags> {
        UpdateTrancheConfigFlags::from_bits(self.bitmask)
    }
}

pub fn handler(
    ctx: Context<UpdateTrancheDataContext>,
    input_data: UpdateTrancheDataInput,
) -> Result<()> {
    // update tranche config account

    let tranche_data = &mut ctx.accounts.tranche_config.tranche_data;

    if input_data
        .get_update_tranche_bitmask()
        .unwrap()
        .contains(UpdateTrancheConfigFlags::HALT_FLAGS)
    {
        msg!("update tranche_data halt_flags");

        #[cfg(feature = "debug")]
        msg!("+ old value: {}", tranche_data.get_halt_flags().bits());

        tranche_data.set_halt_flags(input_data.halt_flags)?;

        #[cfg(feature = "debug")]
        msg!("+ new value: {}", tranche_data.get_halt_flags().bits());
    }

    if input_data
        .get_update_tranche_bitmask()
        .unwrap()
        .contains(UpdateTrancheConfigFlags::RESERVE_FAIR_VALUE_STALE_SLOT_THRESHOLD)
    {
        msg!("update tranche_data reserve_fair_value stale_slot_threashold");

        #[cfg(feature = "debug")]
        msg!(
            "+ old value: {}",
            tranche_data
                .reserve_fair_value
                .slot_tracking
                .stale_slot_threshold
        );

        tranche_data
            .reserve_fair_value
            .slot_tracking
            .stale_slot_threshold = input_data.reserve_fair_value_stale_slot_threshold;

        #[cfg(feature = "debug")]
        msg!(
            "+ new value: {}",
            tranche_data
                .reserve_fair_value
                .slot_tracking
                .stale_slot_threshold
        );
    }

    if input_data
        .get_update_tranche_bitmask()
        .unwrap()
        .contains(UpdateTrancheConfigFlags::RESERVE_FAIR_VALUE_STALE_SLOT_THRESHOLD)
    {
        msg!("update tranche_data tranche_fair_value stale_slot_threashold");

        #[cfg(feature = "debug")]
        msg!(
            "+ old value: {}",
            tranche_data
                .tranche_fair_value
                .slot_tracking
                .stale_slot_threshold
        );

        tranche_data
            .tranche_fair_value
            .slot_tracking
            .stale_slot_threshold = input_data.tranche_fair_value_stale_slot_threshold;

        #[cfg(feature = "debug")]
        msg!(
            "+ new value: {}",
            tranche_data
                .tranche_fair_value
                .slot_tracking
                .stale_slot_threshold
        );
    }

    Ok(())
}