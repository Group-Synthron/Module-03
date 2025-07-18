import { Object as DataType, Property } from 'fabric-contract-api';
import FishBatchStatus from '../enums/FishBatchStatus';

@DataType()
export class FishBatch {
    @Property('ID', 'string')
    ID = '';

    @Property('Location', 'string')
    Location = '';

    @Property('Specie', 'string')
    Specie = '';

    @Property('Quantity', 'number')
    Quantity = 0;

    @Property('Owner', 'string')
    Owner = '';

    @Property('Status', 'string')
    Status = FishBatchStatus.CAUGHT;

    static newInstance(state: Partial<FishBatch> = {}): FishBatch {
        return {
            ID: assertHasValue(state.ID, 'Missing ID'),
            Location: state.Location ?? '',
            Specie: state.Specie ?? '',
            Quantity: state.Quantity ?? 0,
            Owner: assertHasValue(state.Owner, 'Missing Owner'),
            Status: state.Status ?? FishBatchStatus.CAUGHT,
        }
    }
}

function assertHasValue<T>(value: T | undefined | null, message: string): T {
    if (value == undefined || (typeof value === 'string' && value.length === 0)) {
        throw new Error(message);
    }

    return value;
}