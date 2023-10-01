import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { Assurer } from '../wrappers/Assurer';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('Assurer', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Assurer');
    });

    let blockchain: Blockchain;
    let assurer: SandboxContract<Assurer>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        assurer = blockchain.openContract(Assurer.createFromConfig({}, code));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await assurer.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: assurer.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and assurer are ready to use
    });
});
