import { Context, Contract, Info, Param, Returns, Transaction} from 'fabric-contract-api';
import { Asset } from './asset';
import { ClientIdentifier, marshal, setEndorsingOrgs, toJSON, unmarshal } from './util';
import { ORGANIZATIONS } from './organizations';

@Info({title: 'AssetTransfer', description: 'Asset Transfer Smart Contract'})
export class AssetTransfer extends Contract {
    @Transaction()
    @Param('assetObj', 'Asset', 'The asset to be created or updated')
    async CreateAsset(ctx: Context, state: Asset): Promise<void> {
        state.Owner = toJSON(ClientIdentifier(ctx));
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

    @Transaction()
    @Param('assetObj', 'Asset', 'The asset to be updated')
    async UpdateAsset(ctx: Context, assetUpdate: Asset): Promise<void> {
        if (!assetUpdate.ID) {
            throw new Error('Asset ID is required for update');
        }

        const existingAssetBytes = await this.#readAsset(ctx, assetUpdate.ID);
        const existingAsset = Asset.newInstance(unmarshal(existingAssetBytes));

        const updatedState = Object.assign({}, existingAsset, assetUpdate, {
            Owner: existingAsset.Owner, // Must transfer to change owner
        });
        const updatedAsset = Asset.newInstance(updatedState);

        // overwriting original asset with new asset
        const updatedAssetBytes = marshal(updatedAsset);
        await ctx.stub.putState(updatedAsset.ID, updatedAssetBytes);

        await setEndorsingOrgs(ctx, updatedAsset.ID, ctx.clientIdentity.getMSPID());

        ctx.stub.setEvent('UpdateAsset', updatedAssetBytes);
    }
}