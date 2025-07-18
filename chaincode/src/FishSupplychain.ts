import { Context, Contract, Info, Param, Returns, Transaction} from 'fabric-contract-api';
import { FishBatch } from './models/FishBatch';
import { ClientIdentifier, marshal, OwnerIdentifier, setEndorsingOrgs, toJsonString, unmarshal } from './util/util';
import { ORGANIZATIONS } from './enums/Organizations';
import FishBatchStatus from './enums/FishBatchStatus';
import { SeizedFishBatch } from './models/SeizedFishBatch';

@Info({title: 'FishSupplychain', description: 'Fish Supply Chain Smart Contract'})
export class FishSupplychain extends Contract {
    @Transaction()
    @Param('assetObj', 'Asset', 'The asset to be created or updated')
    async CreateAsset(ctx: Context, state: FishBatch): Promise<void> {
        const ownership = ClientIdentifier(ctx);

        if (ownership.organization !== ORGANIZATIONS.VESSEL_OWNER) {
            throw new Error(`Only ${ORGANIZATIONS.VESSEL_OWNER} can create catched fish bulks`);
        }

        state.Owner = toJsonString(ownership);
        const fishBatch = FishBatch.newInstance(state);

        const exists = await this.fishBatchExist(ctx, fishBatch.ID);
        if (exists) {
            throw new Error(`Asset with ID ${fishBatch.ID} already exists`);
        }

        await ctx.stub.putState(fishBatch.ID, marshal(fishBatch));

        // New fish catches should be endorsed by the Vessel Owner
        await setEndorsingOrgs(ctx, fishBatch.ID, ORGANIZATIONS.VESSEL_OWNER)

        ctx.stub.setEvent('FishBatchCreated', Buffer.from(fishBatch.ID));
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to transfer')
    @Param('processorUser', 'string', 'The processor user who should accept this transfer')
    async TransferToProcessing(ctx: Context, fishBatchId: string, processorUser: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from VesselOwner organization
        if (caller.organization !== ORGANIZATIONS.VESSEL_OWNER) {
            throw new Error(`Only ${ORGANIZATIONS.VESSEL_OWNER} can initiate transfer to processing`);
        }

        // Read the existing asset
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));

        // Verify the caller is the current owner of the asset
        const currentOwner = JSON.parse(fishBatch.Owner) as OwnerIdentifier;
        if (currentOwner.user !== caller.user || currentOwner.organization !== caller.organization) {
            throw new Error(`Only the current owner can initiate transfer. Asset is owned by ${currentOwner.user} from ${currentOwner.organization}`);
        }

        if (fishBatch.Status !== FishBatchStatus.CAUGHT) {
            throw new Error(`Fish batch ${fishBatchId} must be in CAUGHT status to transfer. Current status: ${fishBatch.Status}`);
        }

        // Update the asset status to TRANSFERRING (owner remains VesselOwner until accepted)
        const updatedFishBatch = FishBatch.newInstance({
            ...fishBatch,
            Status: FishBatchStatus.TRANSFERRING
        });

        // Store the intended processor user in a separate key for the acceptance process
        const transferInfoKey = `TRANSFER_${fishBatchId}`;
        const transferInfo = {
            intendedProcessor: processorUser,
            initiatedBy: caller.user,
            timestamp: ctx.stub.getTxTimestamp().seconds.toString()
        };

        // Save the updated fish batch and transfer info to the ledger
        await ctx.stub.putState(fishBatchId, marshal(updatedFishBatch));
        await ctx.stub.putState(transferInfoKey, marshal(transferInfo));

        // Update endorsing organizations to include Processor for the acceptance
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.VESSEL_OWNER, ORGANIZATIONS.PROCESSOR);

        // Emit transfer initiation event
        ctx.stub.setEvent('TransferToProcessingInitiated', Buffer.from(fishBatchId));
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to accept')
    async AcceptToProcessing(ctx: Context, fishBatchId: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Processor organization
        if (caller.organization !== ORGANIZATIONS.PROCESSOR) {
            throw new Error(`Only ${ORGANIZATIONS.PROCESSOR} can accept transfers`);
        }

        // Read the existing asset
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const existingAsset = FishBatch.newInstance(unmarshal(fishBatchBytes));

        // Verify the asset is in TRANSFERRING status
        if (existingAsset.Status !== FishBatchStatus.TRANSFERRING) {
            throw new Error(`Asset ${fishBatchId} is not in TRANSFERRING status. Current status: ${existingAsset.Status}`);
        }

        // Check if there's a pending transfer for this asset
        const transferInfoKey = `TRANSFER_${fishBatchId}`;
        const transferInfoBytes = await ctx.stub.getState(transferInfoKey);
        if (transferInfoBytes.length === 0) {
            throw new Error(`No pending transfer found for asset ${fishBatchId}`);
        }

        const transferInfo = unmarshal(transferInfoBytes) as any;
        
        // Verify the caller is the intended processor
        if (transferInfo.intendedProcessor !== caller.user) {
            throw new Error(`Only ${transferInfo.intendedProcessor} can accept this transfer. You are ${caller.user}`);
        }

        // Create the new owner identity for Processor organization
        const newOwnerIdentifier: OwnerIdentifier = {
            organization: ORGANIZATIONS.PROCESSOR,
            user: caller.user
        };

        // Update the asset with new owner and status
        const updatedFishBatch = FishBatch.newInstance({
            ...existingAsset,
            Owner: toJsonString(newOwnerIdentifier),
            Status: FishBatchStatus.PROCESSING
        });

        // Save the updated asset to the ledger
        await ctx.stub.putState(fishBatchId, marshal(updatedFishBatch));

        // Clean up the transfer info
        await ctx.stub.deleteState(transferInfoKey);

        // Update endorsing organizations to include Processor
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.PROCESSOR);

        // Emit transfer acceptance event
        ctx.stub.setEvent('TransferToProcessingAccepted', Buffer.from(fishBatchId));
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to process')
    @Param('newQuantity', 'number', 'The new quantity after processing')
    async ProcessFishBatch(ctx: Context, fishBatchId: string, newQuantity: number): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Processor organization
        if (caller.organization !== ORGANIZATIONS.PROCESSOR) {
            throw new Error(`Only ${ORGANIZATIONS.PROCESSOR} can process fish batches`);
        }

        // Read the existing fish batch
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));

        // Verify the caller is the current owner of the fish batch
        const currentOwner = JSON.parse(fishBatch.Owner) as OwnerIdentifier;
        if (currentOwner.user !== caller.user || currentOwner.organization !== caller.organization) {
            throw new Error(`Only the current owner can process the fish batch. Fish batch is owned by ${currentOwner.user} from ${currentOwner.organization}`);
        }

        // Verify the fish batch is in PROCESSING status
        if (fishBatch.Status !== FishBatchStatus.PROCESSING) {
            throw new Error(`Fish batch ${fishBatchId} must be in PROCESSING status to be processed. Current status: ${fishBatch.Status}`);
        }

        // Validate new quantity
        if (newQuantity <= 0) {
            throw new Error(`New quantity must be greater than 0. Provided: ${newQuantity}`);
        }

        // Update the fish batch with new quantity and status
        const updatedFishBatch = FishBatch.newInstance({
            ...fishBatch,
            Quantity: newQuantity,
            Status: FishBatchStatus.PROCESSED
        });

        // Save the updated fish batch to the ledger
        await ctx.stub.putState(fishBatchId, marshal(updatedFishBatch));

        // Keep endorsing organization as Processor
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.PROCESSOR);

        // Emit processing completion event
        ctx.stub.setEvent('FishBatchProcessed', Buffer.from(fishBatchId));
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to transfer')
    @Param('wholesalerUser', 'string', 'The wholesaler user who should accept this transfer')
    async TransferToWholesale(ctx: Context, fishBatchId: string, wholesalerUser: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Processor organization
        if (caller.organization !== ORGANIZATIONS.PROCESSOR) {
            throw new Error(`Only ${ORGANIZATIONS.PROCESSOR} can initiate transfer to wholesale`);
        }

        // Read the existing fish batch
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));

        // Verify the caller is the current owner of the fish batch
        const currentOwner = JSON.parse(fishBatch.Owner) as OwnerIdentifier;
        if (currentOwner.user !== caller.user || currentOwner.organization !== caller.organization) {
            throw new Error(`Only the current owner can initiate transfer. Fish batch is owned by ${currentOwner.user} from ${currentOwner.organization}`);
        }

        if (fishBatch.Status !== FishBatchStatus.PROCESSED) {
            throw new Error(`Fish batch ${fishBatchId} must be in PROCESSED status to transfer to wholesale. Current status: ${fishBatch.Status}`);
        }

        // Update the fish batch status to TRANSFERRING (owner remains Processor until accepted)
        const updatedFishBatch = FishBatch.newInstance({
            ...fishBatch,
            Status: FishBatchStatus.TRANSFERRING
        });

        // Store the intended wholesaler user in a separate key for the acceptance process
        const transferInfoKey = `TRANSFER_${fishBatchId}`;
        const transferInfo = {
            intendedWholesaler: wholesalerUser,
            initiatedBy: caller.user,
            timestamp: ctx.stub.getTxTimestamp().seconds.toString()
        };

        // Save the updated fish batch and transfer info to the ledger
        await ctx.stub.putState(fishBatchId, marshal(updatedFishBatch));
        await ctx.stub.putState(transferInfoKey, marshal(transferInfo));

        // Update endorsing organizations to include Wholesaler for the acceptance
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.PROCESSOR, ORGANIZATIONS.WHOLESALER);

        // Emit transfer initiation event
        ctx.stub.setEvent('TransferToWholesaleInitiated', Buffer.from(fishBatchId));
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to accept')
    async AcceptToWholesale(ctx: Context, fishBatchId: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Wholesaler organization
        if (caller.organization !== ORGANIZATIONS.WHOLESALER) {
            throw new Error(`Only ${ORGANIZATIONS.WHOLESALER} can accept transfers`);
        }

        // Read the existing fish batch
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));

        // Verify the fish batch is in TRANSFERRING status
        if (fishBatch.Status !== FishBatchStatus.TRANSFERRING) {
            throw new Error(`Fish batch ${fishBatchId} is not in TRANSFERRING status. Current status: ${fishBatch.Status}`);
        }

        // Check if there's a pending transfer for this fish batch
        const transferInfoKey = `TRANSFER_${fishBatchId}`;
        const transferInfoBytes = await ctx.stub.getState(transferInfoKey);
        if (transferInfoBytes.length === 0) {
            throw new Error(`No pending transfer found for fish batch ${fishBatchId}`);
        }

        const transferInfo = unmarshal(transferInfoBytes) as any;
        
        // Verify the caller is the intended wholesaler
        if (transferInfo.intendedWholesaler !== caller.user) {
            throw new Error(`Only ${transferInfo.intendedWholesaler} can accept this transfer. You are ${caller.user}`);
        }

        // Create the new owner identity for Wholesaler organization
        const newOwnerIdentifier: OwnerIdentifier = {
            organization: ORGANIZATIONS.WHOLESALER,
            user: caller.user
        };

        // Update the fish batch with new owner and status
        const updatedFishBatch = FishBatch.newInstance({
            ...fishBatch,
            Owner: toJsonString(newOwnerIdentifier),
            Status: FishBatchStatus.IN_WHOLESALE
        });

        // Save the updated fish batch to the ledger
        await ctx.stub.putState(fishBatchId, marshal(updatedFishBatch));

        // Clean up the transfer info
        await ctx.stub.deleteState(transferInfoKey);

        // Update endorsing organizations to include Wholesaler
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.WHOLESALER);

        // Emit transfer acceptance event
        ctx.stub.setEvent('TransferToWholesaleAccepted', Buffer.from(fishBatchId));
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to sell')
    async SellFishBatch(ctx: Context, fishBatchId: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Wholesaler organization
        if (caller.organization !== ORGANIZATIONS.WHOLESALER) {
            throw new Error(`Only ${ORGANIZATIONS.WHOLESALER} can sell fish batches`);
        }

        // Read the existing fish batch
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));

        // Verify the caller is the current owner of the fish batch
        const currentOwner = JSON.parse(fishBatch.Owner) as OwnerIdentifier;
        if (currentOwner.user !== caller.user || currentOwner.organization !== caller.organization) {
            throw new Error(`Only the current owner can sell the fish batch. Fish batch is owned by ${currentOwner.user} from ${currentOwner.organization}`);
        }

        // Verify the fish batch is in IN_WHOLESALE status
        if (fishBatch.Status !== FishBatchStatus.IN_WHOLESALE) {
            throw new Error(`Fish batch ${fishBatchId} must be in IN_WHOLESALE status to be sold. Current status: ${fishBatch.Status}`);
        }

        // Update the fish batch status to SOLD
        const updatedFishBatch = FishBatch.newInstance({
            ...fishBatch,
            Status: FishBatchStatus.SOLD
        });

        // Save the updated fish batch to the ledger
        await ctx.stub.putState(fishBatchId, marshal(updatedFishBatch));

        // Keep endorsing organization as Wholesaler
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.WHOLESALER);

        // Emit sale completion event
        ctx.stub.setEvent('FishBatchSold', Buffer.from(fishBatchId));
    }

    @Transaction(false)
    @Returns('boolean')
    async fishBatchExist(ctx: Context, fishBatchId: string): Promise<boolean> {
        const fishBatch = await ctx.stub.getState(fishBatchId);
        return fishBatch.length > 0;
    }

    @Transaction(false)
    @Returns('Asset')
    async ReadAsset(ctx: Context, fishBatchId: string): Promise<FishBatch> {
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));

        return fishBatch;
    }

    private async readAsset(ctx: Context, fishBatchId: string): Promise<Uint8Array> {
        const fishBatchBytes = await ctx.stub.getState(fishBatchId);
        if (fishBatchBytes.length === 0) {
            throw new Error(`Fish batch with ID ${fishBatchId} does not exist`);
        }

        return fishBatchBytes;
    }

    @Transaction(false)
    @Returns('string')
    async GetAllAssets(ctx: Context): Promise<string> {
        // range query with empty string for startKey and endKey does an open-ended query of all fish batches in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');

        const fishBatches: FishBatch[] = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const fishBatchBytes = result.value.value;
            try {
                const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));
                fishBatches.push(fishBatch);
            } catch (err) {
                console.log(err);
            }
        }

        return marshal(fishBatches).toString();
    }

    @Transaction(false)
    @Returns('string')
    async GetAllSeizedAssets(ctx: Context): Promise<string> {
        // range query with empty string for startKey and endKey does an open-ended query of all records in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');

        const seizedFishBatches: SeizedFishBatch[] = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const seizedFishBatchBytes = result.value.value;
            try {
                const seizedFishBatch = SeizedFishBatch.newInstance(unmarshal(seizedFishBatchBytes) as SeizedFishBatch);
                seizedFishBatches.push(seizedFishBatch);
            } catch (err) {
                // This will fail for non-seized fish batch objects, which is expected
                console.log(err);
            }
        }

        return marshal(seizedFishBatches).toString();
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to seize')
    @Param('reason', 'string', 'The reason for seizing the fish batch')
    async SeizeAsset(ctx: Context, fishBatchId: string, reason: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            throw new Error(`Only ${ORGANIZATIONS.GOVERNMENT} can seize fish batches`);
        }

        // Read the existing fish batch
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));

        const updatedFishBatch = FishBatch.newInstance({
            ...fishBatch,
            Status: FishBatchStatus.SEIZED,
        });

        const seizedFishBatch = SeizedFishBatch.newInstance({
            AssetID: fishBatchId,
            Timestamp: ctx.stub.getTxTimestamp().seconds.toString(),
            Reason: reason,
            PreviousStatus: fishBatch.Status,
            Officer: caller.user,
        })

        // Save the updated fish batch and seized fish batch to the ledger
        await ctx.stub.putState(fishBatchId, marshal(updatedFishBatch));
        await ctx.stub.putState(`SEIZED_${fishBatchId}`, marshal(seizedFishBatch));
        
        ctx.stub.setEvent('AssetSeized', Buffer.from(fishBatchId));
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the seized fish batch to release')
    async ReleaseSeizedAsset(ctx: Context, fishBatchId: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            throw new Error(`Only ${ORGANIZATIONS.GOVERNMENT} can release seized fish batches`);
        }

        // Read the existing fish batch
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));

        // Verify the fish batch is currently seized
        if (fishBatch.Status !== FishBatchStatus.SEIZED) {
            throw new Error(`Fish batch ${fishBatchId} is not currently seized. Current status: ${fishBatch.Status}`);
        }

        // Read the seized fish batch record
        const seizedFishBatchKey = `SEIZED_${fishBatchId}`;
        const seizedFishBatchBytes = await ctx.stub.getState(seizedFishBatchKey);
        if (seizedFishBatchBytes.length === 0) {
            throw new Error(`No seized fish batch record found for fish batch ${fishBatchId}`);
        }

        const seizedFishBatch = SeizedFishBatch.newInstance(unmarshal(seizedFishBatchBytes) as SeizedFishBatch);

        // Restore the fish batch's previous status
        const updatedFishBatch = FishBatch.newInstance({
            ...fishBatch,
            Status: seizedFishBatch.PreviousStatus as FishBatchStatus,
        });

        // Save the updated fish batch to the ledger
        await ctx.stub.putState(fishBatchId, marshal(updatedFishBatch));

        // Remove the seized fish batch record
        await ctx.stub.deleteState(seizedFishBatchKey);

        // Emit fish batch release event
        ctx.stub.setEvent('SeizedAssetReleased', Buffer.from(fishBatchId));
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the seized fish batch to dispose')
    async DisposeAsset(ctx: Context, fishBatchId: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            throw new Error(`Only ${ORGANIZATIONS.GOVERNMENT} can dispose seized fish batches`);
        }

        // Read the existing fish batch
        const fishBatchBytes = await this.readAsset(ctx, fishBatchId);
        const fishBatch = FishBatch.newInstance(unmarshal(fishBatchBytes));

        // Verify the fish batch is currently seized
        if (fishBatch.Status !== FishBatchStatus.SEIZED) {
            throw new Error(`Fish batch ${fishBatchId} is not currently seized. Current status: ${fishBatch.Status}. Only seized fish batches can be disposed.`);
        }

        // Update the fish batch status to DISPOSED
        const updatedFishBatch = FishBatch.newInstance({
            ...fishBatch,
            Status: FishBatchStatus.DISPOSED,
        });

        // Save the updated fish batch to the ledger
        await ctx.stub.putState(fishBatchId, marshal(updatedFishBatch));

        // Keep the seized fish batch record for audit purposes (don't delete it)
        // This maintains a trail of why the fish batch was seized before disposal

        // Emit fish batch disposal event
        ctx.stub.setEvent('AssetDisposed', Buffer.from(fishBatchId));
    }
}