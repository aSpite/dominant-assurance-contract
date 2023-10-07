import {Address, toNano} from 'ton-core';
import { Assurer } from '../wrappers/Assurer';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import {fees} from "../config";

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const address = Address.parse(await ui.input('Type assurer address: '));
    const assurer = provider.open(Assurer.createFromAddress(address));

    const fundingData = await assurer.getFundingData();
    if(fundingData.participantsCount != fundingData.donatedCounts) {
        ui.write(`Error: Assurer at address ${address} is not fully funded!`);
        return;
    }

    await assurer.sendClaim(
        provider.sender(),
        toNano(1),
        0
    );

    ui.write(`Message sent`);
}
