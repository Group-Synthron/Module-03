import { Object as DataType, Property } from 'fabric-contract-api';

@DataType()
export class SeizedFishBatch {
    @Property('AssetID', 'string')
    AssetID = '';

    @Property('Timestamp', 'string')
    Timestamp = '';

    @Property('Reason', 'string')
    Reason = '';

    @Property('PreviousStatus', 'string')
    PreviousStatus = '';

    @Property('Officer', 'string')
    Officer = '';

    static newInstance(state: SeizedFishBatch): SeizedFishBatch {
        return {
            AssetID: state.AssetID,
            Timestamp: state.Timestamp,
            Reason: state.Reason,
            PreviousStatus: state.PreviousStatus,
            Officer: state.Officer,
        }
    }
}