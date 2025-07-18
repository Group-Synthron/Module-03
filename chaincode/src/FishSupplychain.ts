import { Context, Contract, Info, Param, Returns, Transaction} from 'fabric-contract-api';
import { FishBatch } from './models/FishBatch';
import { ClientIdentifier, marshal, setEndorsingOrgs, unmarshal } from './util/util';
import { ORGANIZATIONS } from './enums/Organizations';
import FishBatchStatus from './enums/FishBatchStatus';
import { SeizedFishBatch } from './models/SeizedFishBatch';
import User from './models/User';
import { responseError, ResponseErrorCodes, ResponseObject, responseSuccess } from './util/responseUtil';

@Info({title: 'FishSupplychain', description: 'Fish Supply Chain Smart Contract'})
export class FishSupplychain extends Contract {
    private async readFishBatch(ctx: Context, fishBatchId: string): Promise<FishBatch> {
        const fishBatchBytes = await ctx.stub.getState(fishBatchId);
        if (fishBatchBytes.length === 0) {
            throw new Error(`Fish batch with ID ${fishBatchId} does not exist`);
        }

        return FishBatch.newInstance(unmarshal(fishBatchBytes));
    }

    private async initiateTransfer(ctx: Context, batch: FishBatch, newOwner: User): Promise<void> {
        const batchId = batch.ID;

        const updatedFishBatch = FishBatch.newInstance({
            ...batch,
            Status: FishBatchStatus.TRANSFERRING
        });

        const transferInfoKey = `TRANSFER_${batchId}`;
        const transferInfo = {
            intendedOwner: newOwner.toString(),
            initiatedBy: ClientIdentifier(ctx).toString(),
            timestamp: ctx.stub.getTxTimestamp().seconds.toString(),
        };

        await ctx.stub.putState(batchId, marshal(updatedFishBatch));
        await ctx.stub.putState(transferInfoKey, marshal(transferInfo));
    }

    /**
     * Accepts a transfer for a fish batch.
     * @param ctx The transaction context
     * @param fishBatch The fish batch being transferred
     * @param newStatus The new status to set for the fish batch
     * @throws Error(STATUS_MISMATCH) if the fish batch is not in TRANSFERRING status
     * @throws Error(IS_NOT_TRANSFERRING) if there is no transfer info available
     * @throws Error(OWNERSHIP_VERIFICATION_FAILED) if the caller is not the intended owner
     */
    private async acceptTransfer(ctx: Context, fishBatch: FishBatch, newStatus: FishBatchStatus): Promise<void> {
        const batchId = fishBatch.ID;

        if (fishBatch.Status !== FishBatchStatus.TRANSFERRING) {
            throw new Error(ResponseErrorCodes.STATUS_MISMATCH);
        }

        // Read the transfer info
        const transferInfoKey = `TRANSFER_${batchId}`;
        const transferInfoBytes = await ctx.stub.getState(transferInfoKey);
        if (transferInfoBytes.length === 0) {
            throw new Error(ResponseErrorCodes.IS_NOT_TRANSFERRING);
        }

        const transferInfo = unmarshal(transferInfoBytes) as any;

        // Verify the caller is the intended owner
        const caller = ClientIdentifier(ctx);
        if (transferInfo.intendedOwner !== caller.toString()) {
            throw new Error(ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED);
        }

        const updatedFishBatch = FishBatch.newInstance({
            ...fishBatch,
            Owner: transferInfo.intendedOwner,
            Status: newStatus
        });

        await ctx.stub.putState(batchId, marshal(updatedFishBatch));
        await ctx.stub.deleteState(transferInfoKey);
    }

    private isOwner(ctx: Context, fishBatch: FishBatch): boolean {
        const caller = ClientIdentifier(ctx);
        return fishBatch.Owner === caller.toString();
    }

    @Transaction()
    @Param('assetObj', 'Asset', 'The asset to be created or updated')
    async CreateAsset(ctx: Context, state: FishBatch): Promise<ResponseObject> {
        const ownership = ClientIdentifier(ctx);

        if (ownership.organization !== ORGANIZATIONS.VESSEL_OWNER) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH)
        }

        state.Owner = ownership.toString();
        const fishBatch = FishBatch.newInstance(state);

        const exists = await this.fishBatchExist(ctx, fishBatch.ID);
        if (exists) {
            return responseError(ResponseErrorCodes.BATCH_ALREADY_EXISTS);
        }

        await ctx.stub.putState(fishBatch.ID, marshal(fishBatch));

        // New fish catches should be endorsed by the Vessel Owner
        await setEndorsingOrgs(ctx, fishBatch.ID, ORGANIZATIONS.VESSEL_OWNER)

        ctx.stub.setEvent('FishBatchCreated', Buffer.from(fishBatch.ID));
        return responseSuccess(fishBatch);
    }


    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to transfer')
    @Param('processorUser', 'string', 'The processor user who should accept this transfer')
    async TransferToProcessing(ctx: Context, fishBatchId: string, processorUser: string): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from VesselOwner organization
        if (caller.organization !== ORGANIZATIONS.VESSEL_OWNER) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH)
        }

        // Read the existing asset
        const fishBatch = await this.readFishBatch(ctx, fishBatchId);

        if (!this.isOwner(ctx, fishBatch)) {
            return responseError(ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED);
        }

        if (fishBatch.Status !== FishBatchStatus.CAUGHT) {
            return responseError(ResponseErrorCodes.STATUS_MISMATCH);
        }

        const transferredTo = new User(
            ORGANIZATIONS.PROCESSOR,
            processorUser
        );

        await this.initiateTransfer(ctx, fishBatch, transferredTo);

        // Update endorsing organizations to include Processor for the acceptance
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.VESSEL_OWNER, ORGANIZATIONS.PROCESSOR);

        // Emit transfer initiation event
        ctx.stub.setEvent('TransferToProcessingInitiated', Buffer.from(fishBatchId));
        return responseSuccess(null)
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to accept')
    async AcceptToProcessing(ctx: Context, fishBatchId: string): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        if (caller.organization !== ORGANIZATIONS.PROCESSOR) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH);
        }

        // Read the existing asset
        const fishBatch = await this.readFishBatch(ctx, fishBatchId);

        try {
            this.acceptTransfer(ctx, fishBatch, FishBatchStatus.PROCESSING);
        } catch (error: any) {
            switch (error.message) {
                case ResponseErrorCodes.IS_NOT_TRANSFERRING:
                    return responseError(ResponseErrorCodes.IS_NOT_TRANSFERRING);
                case ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED:
                    return responseError(ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED);
                case ResponseErrorCodes.STATUS_MISMATCH:
                    return responseError(ResponseErrorCodes.STATUS_MISMATCH);
                default:
                    throw error;
            }
        }

        // Update endorsing organizations to include Processor
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.PROCESSOR);

        // Emit transfer acceptance event
        ctx.stub.setEvent('TransferToProcessingAccepted', Buffer.from(fishBatchId));
        return responseSuccess(null);
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to process')
    @Param('newQuantity', 'number', 'The new quantity after processing')
    async ProcessFishBatch(ctx: Context, fishBatchId: string, newQuantity: number): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Processor organization
        if (caller.organization !== ORGANIZATIONS.PROCESSOR) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH);
        }

        // Read the existing fish batch
        const fishBatch = await this.readFishBatch(ctx, fishBatchId);

        if (!this.isOwner(ctx, fishBatch)) {
            return responseError(ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED);
        }

        // Verify the fish batch is in PROCESSING status
        if (fishBatch.Status !== FishBatchStatus.PROCESSING) {
            return responseError(ResponseErrorCodes.STATUS_MISMATCH);
        }

        // Validate new quantity
        if (newQuantity <= 0) {
            return responseError(ResponseErrorCodes.INVALID_QUANTITY);
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
        return responseSuccess(updatedFishBatch);
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to transfer')
    @Param('wholesalerUser', 'string', 'The wholesaler user who should accept this transfer')
    async TransferToWholesale(ctx: Context, fishBatchId: string, wholesalerUser: string): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Processor organization
        if (caller.organization !== ORGANIZATIONS.PROCESSOR) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH);
        }

        // Read the existing fish batch
        const fishBatch = await this.readFishBatch(ctx, fishBatchId);

        if (!this.isOwner(ctx, fishBatch)) {
            return responseError(ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED);
        }

        if (fishBatch.Status !== FishBatchStatus.PROCESSED) {
            return responseError(ResponseErrorCodes.STATUS_MISMATCH);
        }

        const transferredTo = new User(
            ORGANIZATIONS.WHOLESALER,
            wholesalerUser
        );

        await this.initiateTransfer(ctx, fishBatch, transferredTo);

        // Update endorsing organizations to include Wholesaler for the acceptance
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.PROCESSOR, ORGANIZATIONS.WHOLESALER);

        // Emit transfer initiation event
        ctx.stub.setEvent('TransferToWholesaleInitiated', Buffer.from(fishBatchId));

        return responseSuccess(null);
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to accept')
    async AcceptToWholesale(ctx: Context, fishBatchId: string): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Wholesaler organization
        if (caller.organization !== ORGANIZATIONS.WHOLESALER) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH);
        }

        // Read the existing fish batch
        const fishBatch = await this.readFishBatch(ctx, fishBatchId);

        try {
            this.acceptTransfer(ctx, fishBatch, FishBatchStatus.IN_WHOLESALE);
        } catch (error: any) {
            if (error.message === ResponseErrorCodes.IS_NOT_TRANSFERRING) {
                return responseError(ResponseErrorCodes.IS_NOT_TRANSFERRING);
            } else if (error.message === ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED) {
                return responseError(ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED);
            } else if (error.message === ResponseErrorCodes.STATUS_MISMATCH) {
                return responseError(ResponseErrorCodes.STATUS_MISMATCH);
            }

            throw error;
        }

        // Update endorsing organizations to include Wholesaler
        await setEndorsingOrgs(ctx, fishBatchId, ORGANIZATIONS.WHOLESALER);

        // Emit transfer acceptance event
        ctx.stub.setEvent('TransferToWholesaleAccepted', Buffer.from(fishBatchId));

        return responseSuccess(null);
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the fish batch to sell')
    async SellFishBatch(ctx: Context, fishBatchId: string): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Wholesaler organization
        if (caller.organization !== ORGANIZATIONS.WHOLESALER) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH);
        }

        // Read the existing fish batch
        const fishBatch = await this.readFishBatch(ctx, fishBatchId);

        if (!this.isOwner(ctx, fishBatch)) {
            return responseError(ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED);
        }

        // Verify the fish batch is in IN_WHOLESALE status
        if (fishBatch.Status !== FishBatchStatus.IN_WHOLESALE) {
            return responseError(ResponseErrorCodes.STATUS_MISMATCH);
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
        return responseSuccess(updatedFishBatch);
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
        return this.readFishBatch(ctx, fishBatchId);
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
    async SeizeAsset(ctx: Context, fishBatchId: string, reason: string): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH);
        }

        // Read the existing fish batch
        const fishBatch = await this.readFishBatch(ctx, fishBatchId);

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

        return responseSuccess(updatedFishBatch);
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the seized fish batch to release')
    async ReleaseSeizedAsset(ctx: Context, fishBatchId: string): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH);
        }

        // Read the existing fish batch
        const fishBatch = await this.readFishBatch(ctx, fishBatchId);

        // Verify the fish batch is currently seized
        if (fishBatch.Status !== FishBatchStatus.SEIZED) {
            return responseError(ResponseErrorCodes.STATUS_MISMATCH);
        }

        // Read the seized fish batch record
        const seizedFishBatchKey = `SEIZED_${fishBatchId}`;
        const seizedFishBatchBytes = await ctx.stub.getState(seizedFishBatchKey);
        if (seizedFishBatchBytes.length === 0) {
            return responseError(ResponseErrorCodes.BATCH_DOES_NOT_EXIST);
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

        return responseSuccess(updatedFishBatch);
    }

    @Transaction()
    @Param('fishBatchId', 'string', 'The ID of the seized fish batch to dispose')
    async DisposeAsset(ctx: Context, fishBatchId: string): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH);
        }

        // Read the existing fish batch
        const fishBatch = await this.readFishBatch(ctx, fishBatchId);

        // Verify the fish batch is currently seized
        if (fishBatch.Status !== FishBatchStatus.SEIZED) {
            return responseError(ResponseErrorCodes.STATUS_MISMATCH);
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

        return responseSuccess(updatedFishBatch);
    }
}