import { Object as DataType, Property } from 'fabric-contract-api';

@DataType()
export class Asset {
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

    static newInstance(state: Partial<Asset> = {}): Asset {
        return {
            ID: assertHasValue(state.ID, 'Missing ID'),
            Location: state.Location ?? '',
            Specie: state.Specie ?? '',
            Quantity: state.Quantity ?? 0,
            Owner: assertHasValue(state.Owner, 'Missing Owner'),
        }
    }
}

function assertHasValue<T>(value: T | undefined | null, message: string): T {
    if (value == undefined || (typeof value === 'string' && value.length === 0)) {
        throw new Error(message);
    }

    return value;
}