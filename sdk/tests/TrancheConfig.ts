import * as anchor from "@project-serum/anchor";
import { Vyper } from '../src/index';
import { PublicKey} from "@solana/web3.js";
import * as dotenv from 'dotenv';
import { assert, expect } from "chai";
import {RedeemLogicLendingPlugin} from "../src/plugins/redeemLogicPlugin/redeemLogicLending/RedeemLogicLending";
import {RateMockPlugin} from "../src/plugins/ratePlugin/rateMock/RateMock";
import {UpdateTrancheConfigFlags} from '../src/UpdateTrancheConfigFlags'
import {HaltFlags} from '../src/HaltFlags'
import { OwnerRestrictedIxFlags } from "../src/OwnerRestrictedIxFlags";

dotenv.config();

const vyperCoreId = new PublicKey('mb9NrZKiC3ZYUutgGhXwwkAL6Jkvmu5WLDbxWRZ8L9U');
const rateMockPluginId = new PublicKey('FB7HErqohbgaVV21BRiiMTuiBpeUYT8Yw7Z6EdEL7FAG');
const redeemLogicLendingPluginId = new PublicKey('Gc2ZKNuCpdNKhAzEGS2G9rBSiz4z8MULuC3M3t8EqdWA');

describe('TrancheConfig', () => {

    const provider = anchor.AnchorProvider.env();

    it('fetch existing tranche configuration', async () => {
        
        const vyper = Vyper.create(provider, vyperCoreId);
        const accounts = await provider.connection.getProgramAccounts(vyperCoreId);
        vyper.trancheId = new PublicKey(accounts[0].pubkey);
        const trancheConfig = await vyper.getTrancheConfiguration();

        assert.ok(trancheConfig.reserveMint)
        assert.ok(trancheConfig.reserve)
        expect(trancheConfig.trancheData.haltFlags).to.eql(0);
        expect(trancheConfig.trancheData.ownerRestrictedIx).to.eql(0);
        expect(trancheConfig.trancheData.depositedQuantity).to.eql([0, 0]);
        expect(trancheConfig.trancheData.reserveFairValue.value).to.eql(Array(10).fill(10000));
        expect(trancheConfig.trancheData.reserveFairValue.slotTracking.lastUpdate.slot).to.greaterThan(0);
        expect(trancheConfig.trancheData.trancheFairValue.value).to.eql([10000, 10000]);
        expect(trancheConfig.trancheData.trancheFairValue.slotTracking.lastUpdate.slot).to.greaterThan(0);
        assert.ok(trancheConfig.seniorTrancheMint)
        assert.ok(trancheConfig.juniorTrancheMint)
        assert.ok(trancheConfig.trancheAuthority)
        assert.ok(trancheConfig.authoritySeed)
        assert.ok(trancheConfig.authorityBump)
        expect(trancheConfig.owner.toBase58()).to.eql(provider.wallet.publicKey.toBase58());
        assert.ok(trancheConfig.rateProgram)
        assert.ok(trancheConfig.rateProgramState)
        assert.ok(trancheConfig.redeemLogicProgram)
        assert.ok(trancheConfig.redeemLogicProgramState)
        assert.ok(trancheConfig.version)
        assert.ok(trancheConfig.createdAt)
    });

    it("update tranche halt flags", async () => {
        const vyper = Vyper.create(provider, vyperCoreId)
        const accounts = await provider.connection.getProgramAccounts(vyperCoreId);
        vyper.trancheId = new PublicKey(accounts[0].pubkey);
     
        await vyper.updateTrancheConfig(
            UpdateTrancheConfigFlags.HALT_FLAGS,
            HaltFlags.HALT_DEPOSITS,
            OwnerRestrictedIxFlags.NONE,
            2,
            2
        )

        let trancheConfigAccount = await vyper.program.account.trancheConfig.fetch(vyper.trancheId)

        expect(trancheConfigAccount.trancheData.haltFlags).to.eql(HaltFlags.HALT_DEPOSITS)


        await vyper.updateTrancheConfig(
            UpdateTrancheConfigFlags.HALT_FLAGS,
            HaltFlags.HALT_ALL,
            OwnerRestrictedIxFlags.NONE,
            2,
            2
        )

        trancheConfigAccount = await vyper.program.account.trancheConfig.fetch(vyper.trancheId);

        expect(trancheConfigAccount.trancheData.haltFlags).to.eql(HaltFlags.HALT_ALL);
    })


    it("update fair value stale threshold", async () => {
        const vyper = Vyper.create(provider, vyperCoreId)
        const accounts = await provider.connection.getProgramAccounts(vyperCoreId);
        vyper.trancheId = new PublicKey(accounts[0].pubkey);

        let trancheConfigAccount = await vyper.program.account.trancheConfig.fetch(vyper.trancheId);

        //@ts-expect-error
        expect(trancheConfigAccount.trancheData.reserveFairValue.slotTracking.staleSlotThreshold.toNumber()).to.eql(2);
        //@ts-expect-error
        expect(trancheConfigAccount.trancheData.trancheFairValue.slotTracking.staleSlotThreshold.toNumber()).to.eql(2);

        const newStaleSlotThreshold = 4;

        await vyper.updateTrancheConfig(
            UpdateTrancheConfigFlags.RESERVE_FAIR_VALUE_STALE_SLOT_THRESHOLD | UpdateTrancheConfigFlags.TRANCHE_FAIR_VALUE_STALE_SLOT_THRESHOLD,
            HaltFlags.HALT_ALL,
            OwnerRestrictedIxFlags.NONE,
            newStaleSlotThreshold,
            newStaleSlotThreshold,
        )
        trancheConfigAccount = await vyper.program.account.trancheConfig.fetch(vyper.trancheId);

        //@ts-expect-error
        expect(trancheConfigAccount.trancheData.reserveFairValue.slotTracking.staleSlotThreshold.toNumber()).to.eql(
            newStaleSlotThreshold
        );
        //@ts-expect-error
        expect(trancheConfigAccount.trancheData.trancheFairValue.slotTracking.staleSlotThreshold.toNumber()).to.eql(
            newStaleSlotThreshold
        );
    });

    it('refresh tranche fair value', async () => {
        
        let vyper = Vyper.create(provider,vyperCoreId);
        const accounts = await provider.connection.getProgramAccounts(vyperCoreId);
        vyper.trancheId = new PublicKey(accounts[0].pubkey);
        let trancheConfig = await vyper.getTrancheConfiguration();

        let rateMockPlugin = RateMockPlugin.create(provider,rateMockPluginId);
        rateMockPlugin.rateMockStateId=trancheConfig.rateProgramState;

        let redeemLogicLendingPlugin = RedeemLogicLendingPlugin.create(provider,redeemLogicLendingPluginId)
        redeemLogicLendingPlugin.redeemLendingStateId=trancheConfig.redeemLogicProgramState;

        // creating vyper with all plugins
        vyper = Vyper.create(provider,
            vyperCoreId,
            redeemLogicLendingPlugin,
            rateMockPlugin
        )
        vyper.trancheId = new PublicKey(accounts[0].pubkey);
        
        
        // with rpc call
        await rateMockPlugin.setFairValue(1500);
        await vyper.refreshTrancheFairValue();
        trancheConfig = await vyper.getTrancheConfiguration();
        expect(trancheConfig.trancheData.reserveFairValue.value[0]).to.eq(1500);
        expect(trancheConfig.trancheData.trancheFairValue.value).to.eql([10000, 10000]);


        // with instruction call
        await rateMockPlugin.setFairValue(2500);
        const tx = new anchor.web3.Transaction();
        const instruction = await vyper.getRefreshTrancheFairValueIX();
        tx.add(instruction);
        await provider.sendAndConfirm(tx);
        trancheConfig = await vyper.getTrancheConfiguration();
        expect(trancheConfig.trancheData.reserveFairValue.value[0]).to.eq(2500);
        expect(trancheConfig.trancheData.trancheFairValue.value).to.eql([10000, 10000]);
    })
});