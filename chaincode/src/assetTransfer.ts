import { Context, Contract, Info, Param, Returns, Transaction} from 'fabric-contract-api';
import { Asset, AssetStatus, SeizedAsset } from './asset';
import { ClientIdentifier, marshal, OwnerIdentifier, setEndorsingOrgs, toJSON, unmarshal } from './util';
import { ORGANIZATIONS } from './organizations';

@Info({title: 'AssetTransfer', description: 'Asset Transfer Smart Contract'})
export class AssetTransfer extends Contract {
    @Transaction()
    @Param('assetObj', 'Asset', 'The asset to be created or updated')
    async CreateAsset(ctx: Context, state: Asset): Promise<void> {
        const ownership = ClientIdentifier(ctx);

        if (ownership.organization !== ORGANIZATIONS.VESSEL_OWNER) {
            throw new Error(`Only ${ORGANIZATIONS.VESSEL_OWNER} can create catched fish bulks`);
        }

        state.Owner = toJSON(ownership);
        const asset = Asset.newInstance(state);

        const exists = await this.AssetExists(ctx, asset.ID);
        if (exists) {
            throw new Error(`Asset with ID ${asset.ID} already exists`);
        }

        const assetBytes = marshal(asset);
        await ctx.stub.putState(asset.ID, assetBytes);

        // New fish catches should be endorsed by the Vessel Owner
        await setEndorsingOrgs(ctx, asset.ID, ORGANIZATIONS.VESSEL_OWNER)

        ctx.stub.setEvent('CreateAsset', assetBytes);
    }

    @Transaction()
    @Param('assetID', 'string', 'The ID of the asset to transfer')
    @Param('processorUser', 'string', 'The processor user who should accept this transfer')
    async TransferToProcessing(ctx: Context, assetID: string, processorUser: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from VesselOwner organization
        if (caller.organization !== ORGANIZATIONS.VESSEL_OWNER) {
            throw new Error(`Only ${ORGANIZATIONS.VESSEL_OWNER} can initiate transfer to processing`);
        }

        // Read the existing asset
        const existingAssetBytes = await this.#readAsset(ctx, assetID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        // Verify the caller is the current owner of the asset
        const currentOwner = JSON.parse(existingAsset.Owner) as OwnerIdentifier;
        if (currentOwner.user !== caller.user || currentOwner.organization !== caller.organization) {
            throw new Error(`Only the current owner can initiate transfer. Asset is owned by ${currentOwner.user} from ${currentOwner.organization}`);
        }

        if (existingAsset.Status !== AssetStatus.CAUGHT) {
            throw new Error(`Asset ${assetID} must be in CAUGHT status to transfer. Current status: ${existingAsset.Status}`);
        }

        // Update the asset status to TRANSFERRING (owner remains VesselOwner until accepted)
        const updatedAsset = Asset.newInstance({
            ...existingAsset,
            Status: AssetStatus.TRANSFERRING
        });

        // Store the intended processor user in a separate key for the acceptance process
        const transferInfoKey = `TRANSFER_${assetID}`;
        const transferInfo = {
            intendedProcessor: processorUser,
            initiatedBy: caller.user,
            timestamp: ctx.stub.getTxTimestamp().seconds.toString()
        };

        // Save the updated asset and transfer info to the ledger
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(assetID, updatedAssetBytes);
        await ctx.stub.putState(transferInfoKey, marshal(transferInfo));

        // Update endorsing organizations to include Processor for the acceptance
        await setEndorsingOrgs(ctx, assetID, ORGANIZATIONS.VESSEL_OWNER, ORGANIZATIONS.PROCESSOR);

        // Emit transfer initiation event
        ctx.stub.setEvent('TransferToProcessingInitiated', updatedAssetBytes);
    }

    @Transaction()
    @Param('assetID', 'string', 'The ID of the asset to accept')
    async AcceptToProcessing(ctx: Context, assetID: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Processor organization
        if (caller.organization !== ORGANIZATIONS.PROCESSOR) {
            throw new Error(`Only ${ORGANIZATIONS.PROCESSOR} can accept transfers`);
        }

        // Read the existing asset
        const existingAssetBytes = await this.#readAsset(ctx, assetID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        // Verify the asset is in TRANSFERRING status
        if (existingAsset.Status !== AssetStatus.TRANSFERRING) {
            throw new Error(`Asset ${assetID} is not in TRANSFERRING status. Current status: ${existingAsset.Status}`);
        }

        // Check if there's a pending transfer for this asset
        const transferInfoKey = `TRANSFER_${assetID}`;
        const transferInfoBytes = await ctx.stub.getState(transferInfoKey);
        if (transferInfoBytes.length === 0) {
            throw new Error(`No pending transfer found for asset ${assetID}`);
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
        const updatedAsset = Asset.newInstance({
            ...existingAsset,
            Owner: toJSON(newOwnerIdentifier),
            Status: AssetStatus.PROCESSING
        });

        // Save the updated asset to the ledger
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(assetID, updatedAssetBytes);

        // Clean up the transfer info
        await ctx.stub.deleteState(transferInfoKey);

        // Update endorsing organizations to include Processor
        await setEndorsingOrgs(ctx, assetID, ORGANIZATIONS.PROCESSOR);

        // Emit transfer acceptance event
        ctx.stub.setEvent('TransferToProcessingAccepted', updatedAssetBytes);
    }

    @Transaction()
    @Param('assetID', 'string', 'The ID of the asset to process')
    @Param('newQuantity', 'number', 'The new quantity after processing')
    async ProcessFishBatch(ctx: Context, assetID: string, newQuantity: number): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Processor organization
        if (caller.organization !== ORGANIZATIONS.PROCESSOR) {
            throw new Error(`Only ${ORGANIZATIONS.PROCESSOR} can process fish batches`);
        }

        // Read the existing asset
        const existingAssetBytes = await this.#readAsset(ctx, assetID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        // Verify the caller is the current owner of the asset
        const currentOwner = JSON.parse(existingAsset.Owner) as OwnerIdentifier;
        if (currentOwner.user !== caller.user || currentOwner.organization !== caller.organization) {
            throw new Error(`Only the current owner can process the asset. Asset is owned by ${currentOwner.user} from ${currentOwner.organization}`);
        }

        // Verify the asset is in PROCESSING status
        if (existingAsset.Status !== AssetStatus.PROCESSING) {
            throw new Error(`Asset ${assetID} must be in PROCESSING status to be processed. Current status: ${existingAsset.Status}`);
        }

        // Validate new quantity
        if (newQuantity <= 0) {
            throw new Error(`New quantity must be greater than 0. Provided: ${newQuantity}`);
        }

        // Update the asset with new quantity and status
        const updatedAsset = Asset.newInstance({
            ...existingAsset,
            Quantity: newQuantity,
            Status: AssetStatus.PROCESSED
        });

        // Save the updated asset to the ledger
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(assetID, updatedAssetBytes);

        // Keep endorsing organization as Processor
        await setEndorsingOrgs(ctx, assetID, ORGANIZATIONS.PROCESSOR);

        // Emit processing completion event
        ctx.stub.setEvent('FishBatchProcessed', updatedAssetBytes);
    }

    @Transaction()
    @Param('assetID', 'string', 'The ID of the asset to transfer')
    @Param('wholesalerUser', 'string', 'The wholesaler user who should accept this transfer')
    async TransferToWholesale(ctx: Context, assetID: string, wholesalerUser: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Processor organization
        if (caller.organization !== ORGANIZATIONS.PROCESSOR) {
            throw new Error(`Only ${ORGANIZATIONS.PROCESSOR} can initiate transfer to wholesale`);
        }

        // Read the existing asset
        const existingAssetBytes = await this.#readAsset(ctx, assetID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        // Verify the caller is the current owner of the asset
        const currentOwner = JSON.parse(existingAsset.Owner) as OwnerIdentifier;
        if (currentOwner.user !== caller.user || currentOwner.organization !== caller.organization) {
            throw new Error(`Only the current owner can initiate transfer. Asset is owned by ${currentOwner.user} from ${currentOwner.organization}`);
        }

        if (existingAsset.Status !== AssetStatus.PROCESSED) {
            throw new Error(`Asset ${assetID} must be in PROCESSED status to transfer to wholesale. Current status: ${existingAsset.Status}`);
        }

        // Update the asset status to TRANSFERRING (owner remains Processor until accepted)
        const updatedAsset = Asset.newInstance({
            ...existingAsset,
            Status: AssetStatus.TRANSFERRING
        });

        // Store the intended wholesaler user in a separate key for the acceptance process
        const transferInfoKey = `TRANSFER_${assetID}`;
        const transferInfo = {
            intendedWholesaler: wholesalerUser,
            initiatedBy: caller.user,
            timestamp: ctx.stub.getTxTimestamp().seconds.toString()
        };

        // Save the updated asset and transfer info to the ledger
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(assetID, updatedAssetBytes);
        await ctx.stub.putState(transferInfoKey, marshal(transferInfo));

        // Update endorsing organizations to include Wholesaler for the acceptance
        await setEndorsingOrgs(ctx, assetID, ORGANIZATIONS.PROCESSOR, ORGANIZATIONS.WHOLESALER);

        // Emit transfer initiation event
        ctx.stub.setEvent('TransferToWholesaleInitiated', updatedAssetBytes);
    }

    @Transaction()
    @Param('assetID', 'string', 'The ID of the asset to accept')
    async AcceptToWholesale(ctx: Context, assetID: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Wholesaler organization
        if (caller.organization !== ORGANIZATIONS.WHOLESALER) {
            throw new Error(`Only ${ORGANIZATIONS.WHOLESALER} can accept transfers`);
        }

        // Read the existing asset
        const existingAssetBytes = await this.#readAsset(ctx, assetID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        // Verify the asset is in TRANSFERRING status
        if (existingAsset.Status !== AssetStatus.TRANSFERRING) {
            throw new Error(`Asset ${assetID} is not in TRANSFERRING status. Current status: ${existingAsset.Status}`);
        }

        // Check if there's a pending transfer for this asset
        const transferInfoKey = `TRANSFER_${assetID}`;
        const transferInfoBytes = await ctx.stub.getState(transferInfoKey);
        if (transferInfoBytes.length === 0) {
            throw new Error(`No pending transfer found for asset ${assetID}`);
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

        // Update the asset with new owner and status
        const updatedAsset = Asset.newInstance({
            ...existingAsset,
            Owner: toJSON(newOwnerIdentifier),
            Status: AssetStatus.IN_WHOLESALE
        });

        // Save the updated asset to the ledger
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(assetID, updatedAssetBytes);

        // Clean up the transfer info
        await ctx.stub.deleteState(transferInfoKey);

        // Update endorsing organizations to include Wholesaler
        await setEndorsingOrgs(ctx, assetID, ORGANIZATIONS.WHOLESALER);

        // Emit transfer acceptance event
        ctx.stub.setEvent('TransferToWholesaleAccepted', updatedAssetBytes);
    }

    @Transaction()
    @Param('assetID', 'string', 'The ID of the asset to sell')
    async SellFishBatch(ctx: Context, assetID: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from Wholesaler organization
        if (caller.organization !== ORGANIZATIONS.WHOLESALER) {
            throw new Error(`Only ${ORGANIZATIONS.WHOLESALER} can sell fish batches`);
        }

        // Read the existing asset
        const existingAssetBytes = await this.#readAsset(ctx, assetID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        // Verify the caller is the current owner of the asset
        const currentOwner = JSON.parse(existingAsset.Owner) as OwnerIdentifier;
        if (currentOwner.user !== caller.user || currentOwner.organization !== caller.organization) {
            throw new Error(`Only the current owner can sell the asset. Asset is owned by ${currentOwner.user} from ${currentOwner.organization}`);
        }

        // Verify the asset is in IN_WHOLESALE status
        if (existingAsset.Status !== AssetStatus.IN_WHOLESALE) {
            throw new Error(`Asset ${assetID} must be in IN_WHOLESALE status to be sold. Current status: ${existingAsset.Status}`);
        }

        // Update the asset status to SOLD
        const updatedAsset = Asset.newInstance({
            ...existingAsset,
            Status: AssetStatus.SOLD
        });

        // Save the updated asset to the ledger
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(assetID, updatedAssetBytes);

        // Keep endorsing organization as Wholesaler
        await setEndorsingOrgs(ctx, assetID, ORGANIZATIONS.WHOLESALER);

        // Emit sale completion event
        ctx.stub.setEvent('FishBatchSold', updatedAssetBytes);
    }

    @Transaction(false)
    @Returns('boolean')
    async AssetExists(ctx: Context, assetID: string): Promise<boolean> {
        const assetJson = await ctx.stub.getState(assetID);
        return assetJson.length > 0;
    }

    @Transaction(false)
    @Returns('Asset')
    async ReadAsset(ctx: Context, assetID: string): Promise<Asset> {
        const assetBytes = await this.#readAsset(ctx, assetID);
        const asset = Asset.newInstance(unmarshal(assetBytes));

        return asset;
    }

    async #readAsset(ctx: Context, assetID: string): Promise<Uint8Array> {
        const assetBytes = await ctx.stub.getState(assetID);
        if (assetBytes.length === 0) {
            throw new Error(`Asset with ID ${assetID} does not exist`);
        }

        return assetBytes;
    }

    @Transaction(false)
    @Returns('string')
    async GetAllAssets(ctx: Context): Promise<string> {
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');

        const assets: Asset[] = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const assetBytes = result.value.value;
            try {
                const asset = Asset.newInstance(unmarshal(assetBytes));
                assets.push(asset);
            } catch (err) {
                console.log(err);
            }
        }

        return marshal(assets).toString();
    }

    @Transaction(false)
    @Returns('string')
    async GetAllSeizedAssets(ctx: Context): Promise<string> {
        // range query with empty string for startKey and endKey does an open-ended query of all records in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');

        const seizedAssets: SeizedAsset[] = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const seizedAssetBytes = result.value.value;
            try {
                const seizedAsset = SeizedAsset.newInstance(unmarshal(seizedAssetBytes) as SeizedAsset);
                seizedAssets.push(seizedAsset);
            } catch (err) {
                // This will fail for non-seized asset objects, which is expected
                console.log(err);
            }
        }

        return marshal(seizedAssets).toString();
    }

    @Transaction()
    @Param('assetID', 'string', 'The ID of the asset to seize')
    @Param('reason', 'string', 'The reason for seizing the asset')
    async SeizeAsset(ctx: Context, assetID: string, reason: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            throw new Error(`Only ${ORGANIZATIONS.GOVERNMENT} can sell fish batches`);
        }

        // Read the existing asset
        const existingAssetBytes = await this.#readAsset(ctx, assetID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        const updatedAsset = Asset.newInstance({
            ...existingAsset,
            Status: AssetStatus.SEIZED,
        });

        const seizedAsset = SeizedAsset.newInstance({
            AssetID: assetID,
            Timestamp: ctx.stub.getTxTimestamp().toString(),
            Reason: reason,
            PreviousStatus: existingAsset.Status,
            Officer: caller.user,
        })

        // Save the updated asset and seized asset to the ledger
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(assetID, updatedAssetBytes);

        const seizedAssetBytes = marshal(seizedAsset);
        await ctx.stub.putState(`SEIZED_${assetID}`, seizedAssetBytes);
        
        ctx.stub.setEvent('AssetSeized', updatedAssetBytes);
    }

    @Transaction()
    @Param('assetID', 'string', 'The ID of the seized asset to release')
    async ReleaseSeizedAsset(ctx: Context, assetID: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            throw new Error(`Only ${ORGANIZATIONS.GOVERNMENT} can release seized assets`);
        }

        // Read the existing asset
        const existingAssetBytes = await this.#readAsset(ctx, assetID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        // Verify the asset is currently seized
        if (existingAsset.Status !== AssetStatus.SEIZED) {
            throw new Error(`Asset ${assetID} is not currently seized. Current status: ${existingAsset.Status}`);
        }

        // Read the seized asset record
        const seizedAssetKey = `SEIZED_${assetID}`;
        const seizedAssetBytes = await ctx.stub.getState(seizedAssetKey);
        if (seizedAssetBytes.length === 0) {
            throw new Error(`No seized asset record found for asset ${assetID}`);
        }

        const seizedAsset = SeizedAsset.newInstance(unmarshal(seizedAssetBytes) as SeizedAsset);

        // Restore the asset's previous status
        const updatedAsset = Asset.newInstance({
            ...existingAsset,
            Status: seizedAsset.PreviousStatus as AssetStatus,
        });

        // Save the updated asset to the ledger
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(assetID, updatedAssetBytes);

        // Remove the seized asset record
        await ctx.stub.deleteState(seizedAssetKey);

        // Emit asset release event
        ctx.stub.setEvent('SeizedAssetReleased', updatedAssetBytes);
    }

    @Transaction()
    @Param('assetID', 'string', 'The ID of the seized asset to dispose')
    async DisposeAsset(ctx: Context, assetID: string): Promise<void> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            throw new Error(`Only ${ORGANIZATIONS.GOVERNMENT} can dispose seized assets`);
        }

        // Read the existing asset
        const existingAssetBytes = await this.#readAsset(ctx, assetID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        // Verify the asset is currently seized
        if (existingAsset.Status !== AssetStatus.SEIZED) {
            throw new Error(`Asset ${assetID} is not currently seized. Current status: ${existingAsset.Status}. Only seized assets can be disposed.`);
        }

        // Update the asset status to DISPOSED
        const updatedAsset = Asset.newInstance({
            ...existingAsset,
            Status: AssetStatus.DISPOSED,
        });

        // Save the updated asset to the ledger
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(assetID, updatedAssetBytes);

        // Keep the seized asset record for audit purposes (don't delete it)
        // This maintains a trail of why the asset was seized before disposal

        // Emit asset disposal event
        ctx.stub.setEvent('AssetDisposed', updatedAssetBytes);
    }
}