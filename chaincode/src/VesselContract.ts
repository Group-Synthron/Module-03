import { Contract, Context, Info, Returns, Transaction } from 'fabric-contract-api';
import { Vessel } from './models/Vessel';
import { ORGANIZATIONS } from './enums/Organizations';
import { ClientIdentifier } from './util/util';
import { marshal, unmarshal } from './util/util';
import User from './models/User';
import { responseError, ResponseErrorCodes, ResponseObject, responseSuccess } from './util/responseUtil';

@Info({ title: 'VesselContract', description: 'Vessel Management Smart Contract' })
export class VesselContract extends Contract {
    @Transaction()
    async CreateVessel(ctx: Context, id: string, ownerUserName: string, licenseNumber: string): Promise<ResponseObject> {
        const caller = ClientIdentifier(ctx);

        // Verify caller is from the government organization
        if (caller.organization !== ORGANIZATIONS.GOVERNMENT) {
            return responseError(ResponseErrorCodes.ORGANIZATION_MISMATCH);
        }

        const vesselOwner = new User(ORGANIZATIONS.VESSEL_OWNER, ownerUserName);
        const vessel = Vessel.newInstance(id, vesselOwner.toString(), licenseNumber);

        // Save the vessel to the ledger
        await ctx.stub.putState(`vessel.${vessel.ID}`, marshal(vessel));

        ctx.stub.setEvent('VesselCreated', Buffer.from(vessel.ID));
        return responseSuccess(vessel);
    }

    @Transaction(false)
    @Returns('string')
    async GetAllVessels(ctx: Context): Promise<string> {
        const iterator = await ctx.stub.getStateByRange('', '');

        const vessels: Vessel[] = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const key = result.value.key;
            if (!key.startsWith('vessel.')) {
                continue;
            }
            const vessel = unmarshal(result.value.value) as Vessel;
            vessels.push(vessel);
        }

        return marshal(vessels).toString();
    }
}