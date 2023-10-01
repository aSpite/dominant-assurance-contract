import { toNano } from 'ton-core';
import { Assurer } from '../wrappers/Assurer';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const assurer = provider.open(Assurer.createFromConfig({}, await compile('Assurer')));

    await assurer.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(assurer.address);

    // run methods on `assurer`
}
