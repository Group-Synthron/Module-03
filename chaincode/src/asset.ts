import { Object as DataType, Property } from 'fabric-contract-api';

@DataType()
export class Asset {
    @Property('ID', 'string')
    ID = '';

    @Property('Name', 'string')
    Name = '';

    @Property('Quantity', 'number')
    Quantity = 0;

    @Property('Owner', 'string')
    Owner = '';

    static newInstance(state: Partial<Asset> = {}): Asset {
        return {
            ID: assertHasValue(state.ID, 'Missing ID'),
            Name: state.Name ?? '',
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