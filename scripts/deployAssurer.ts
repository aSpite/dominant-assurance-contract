import { toNano } from 'ton-core';
import { Assurer } from '../wrappers/Assurer';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import {fees} from "../config";

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const assurer = provider.open(Assurer.createFromConfig({
        createdTime: Math.ceil(Date.now() / 1000),
        authorAddress: provider.sender().address!
    }, await compile('Assurer')));

    const goal: bigint = toNano(await ui.input('Type goal (integer): '));
    const guaranteeAmount: bigint = toNano(await ui.input('Type guarantee amount (integer): '));
    const participantsCount: number = Number(await ui.input('Type participants count (integer): '));
    const validUntil: number = parseInt(await ui.input('Type valid until (timestamp in seconds): '));

    await assurer.sendDeploy(
        provider.sender(),
        guaranteeAmount + fees.init + toNano('0.05'),
        goal,
        guaranteeAmount,
        participantsCount,
        validUntil
    );
    await provider.waitForDeploy(assurer.address);
    console.log(`Deployed at ${assurer.address.toString()}`);
}
