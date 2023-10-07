import {Address, toNano} from 'ton-core';
import { Assurer } from '../wrappers/Assurer';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import {fees} from "../config";

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const address = Address.parse(await ui.input('Type assurer address: '));
    const assurer = provider.open(Assurer.createFromAddress(address));

    const isActive = await assurer.getIsActive();
    if (!isActive) {
        ui.write(`Error: Assurer at address ${address} is not active!`);
        return;
    }
    const fundingData = await assurer.getFundingData();

    await assurer.sendDonate(
        provider.sender(),
        fundingData.donateAmount + fees.donate,
        0
    );

    ui.write(`Message sent`);
}
