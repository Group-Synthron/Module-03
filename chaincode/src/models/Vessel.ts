import { Object as DataType, Property } from 'fabric-contract-api';

@DataType()
export class Vessel {
    @Property('ID', 'string')
    ID = '';

    @Property('Owner', 'string')
    Owner = '';

    @Property('LicenseNumber', 'string')
    LicenseNumber = '';

    static newInstance(id: string, owner: string, licenseNumber: string): Vessel {
        return {
            ID: id,
            Owner: owner,
            LicenseNumber: licenseNumber,
        };
    }
}