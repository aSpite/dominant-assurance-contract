import {Blockchain, SandboxContract, TreasuryContract} from '@ton-community/sandbox';
import {Cell, Sender, toNano, TransactionComputeVm, TransactionDescriptionGeneric} from 'ton-core';
import { Assurer } from '../wrappers/Assurer';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

async function getInitDeployPhase(
    assurer: SandboxContract<Assurer>,
    sender: Sender,
    value: bigint,
    goal: bigint,
    guaranteeAmount: bigint,
    participantsCount: number,
    validUntil: number
) : Promise<TransactionComputeVm> {
    let deployResult = await assurer.sendDeploy(sender,
        value,
        goal,
        guaranteeAmount,
        participantsCount,
        validUntil
    );

    let description = deployResult.transactions[1].description as TransactionDescriptionGeneric;
    return description.computePhase as TransactionComputeVm
}

describe('Assurer', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Assurer');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>
    let assurer: SandboxContract<Assurer>;
    const errors = {
        unauthorized: 100,
        smallFundingAmount: 101,
        smallGuaranteeAmount: 102,
        bigGuaranteeAmount: 103,
        manyParticipants: 104,
        bigFundingPeriod: 105,
        smallDonateAmount: 106,
        notEnoughCoins: 107
    }
    let users: SandboxContract<TreasuryContract>[];

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        users = [];
        for(let i = 0; i < 12; i++) {
            users.push(await blockchain.treasury(`user ${i}`))
        }

        assurer = blockchain.openContract(Assurer.createFromConfig({
            createdTime: Math.ceil(Date.now() / 1000),
            authorAddress: deployer.address
        }, code));
    });

    it('should deploy', async () => {
        const deployResult = await assurer.sendDeploy(deployer.getSender(),
            toNano(21),
            toNano(100),
            toNano(20),
            10,
            Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
        );
        // console.log(deployResult.transactions[1])
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: assurer.address,
            deploy: true,
            success: true,
        });
    });

    it('should handle init errors', async() => {
        assurer = blockchain.openContract(Assurer.createFromConfig({
            createdTime: Math.ceil(Date.now() / 1000),
            authorAddress: deployer.address
        }, code));

        let computePhase = await getInitDeployPhase(assurer, deployer.getSender(),
            toNano(21),
            toNano(49),
            toNano(20),
            10,
            Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
        );
        expect(computePhase.exitCode).toStrictEqual(errors.smallFundingAmount);

        computePhase = await getInitDeployPhase(assurer, users[0].getSender(),
            toNano(21),
            toNano(50),
            toNano(20),
            10,
            Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
        );
        expect(computePhase.exitCode).toStrictEqual(errors.unauthorized);

        computePhase = await getInitDeployPhase(assurer, deployer.getSender(),
            toNano(21),
            toNano(100),
            4_999_999_999n,
            10,
            Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
        );
        expect(computePhase.exitCode).toStrictEqual(errors.smallGuaranteeAmount);

        computePhase = await getInitDeployPhase(assurer, deployer.getSender(),
            toNano(21),
            toNano(100),
            toNano(26),
            10,
            Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
        );
        expect(computePhase.exitCode).toStrictEqual(errors.bigGuaranteeAmount);

        // Not actual in case of 8 bits for participantsCount
        // computePhase = await getInitDeployPhase(assurer, deployer.getSender(),
        //     toNano(21),
        //     toNano(100),
        //     toNano(26),
        //     255,
        //     Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
        // );
        // expect(computePhase.exitCode).toStrictEqual(errors.bigGuaranteeAmount)

        computePhase = await getInitDeployPhase(assurer, deployer.getSender(),
            toNano(21),
            toNano(100),
            toNano(25),
            10,
            Math.ceil(Date.now() / 1000) + 60 * 60 * 24 * 31 // + 31 days
        );
        /*
            For Math.ceil(Date.now() / 1000) + 60 * 60 * 24 * 31 // + 31 days,
            there would not be a bigFundingPeriod error, because it takes about
            1 second to handle the transaction, so in this case, we get 31 days
            and 1 second for validUntil
         */
        expect(computePhase.exitCode).toStrictEqual(errors.bigFundingPeriod);

        computePhase = await getInitDeployPhase(assurer, deployer.getSender(),
            toNano(21),
            toNano(100),
            toNano(25),
            101,
            Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
        );

        expect(computePhase.exitCode).toStrictEqual(errors.smallDonateAmount);

        computePhase = await getInitDeployPhase(assurer, deployer.getSender(),
            24_999_999_999n,
            toNano(100),
            toNano(25),
            100,
            Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
        );

        expect(computePhase.exitCode).toStrictEqual(errors.notEnoughCoins);
    });
});
