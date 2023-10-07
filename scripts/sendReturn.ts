import {Address, toNano} from 'ton-core';
import { Assurer } from '../wrappers/Assurer';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const address = Address.parse(await ui.input('Type assurer address: '));
    const assurer = provider.open(Assurer.createFromAddress(address));

    const isActive = await assurer.getIsActive();
    if (isActive) {
        ui.write(`Error: Assurer at address ${address} is active!`);
        return;
    }
    const fundingData = await assurer.getFundingData();
    if(fundingData.participantsCount === fundingData.donatedCounts) {
        ui.write(`Error: Assurer at address ${address} is fully funded!`);
        return;
    }

    await assurer.sendReturn();

    ui.write(`Message sent`);
}
