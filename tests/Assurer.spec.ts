import {Blockchain, SandboxContract, SendMessageResult, TreasuryContract} from '@ton-community/sandbox';
import {
    Address,
    beginCell,
    Cell,
    Sender,
    Slice,
    toNano,
    TransactionComputeVm,
    TransactionDescriptionGeneric
} from 'ton-core';
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

const errors = {
    unauthorized: 100,
    smallFundingAmount: 101,
    smallGuaranteeAmount: 102,
    bigGuaranteeAmount: 103,
    manyParticipants: 104,
    bigFundingPeriod: 105,
    smallDonateAmount: 106,
    notEnoughCoins: 107,
    notEnoughDonate: 108,
    notActive: 109,
    alreadyDonated: 110,
    underfunded: 111,
    stillActive: 112
};

const initData = {
    value: 21_000_000_000n,
    goal: 100_000_000_000n,
    guaranteeAmount: 20_000_000_000n,
    participantsCount: 10,
    validUntil: Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
};

const opcodes = {
    donate: 0x6e89546a,
    claim: 0xed7ae559
};

const fees = {
    init: 1n,
    donate: 100_000_000n
}

describe('Assurer', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Assurer');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>
    let assurer: SandboxContract<Assurer>;
    const deploy = async (): Promise<SendMessageResult> => {
        return await assurer.sendDeploy(deployer.getSender(),
            initData.value,
            initData.goal,
            initData.guaranteeAmount,
            initData.participantsCount,
            initData.validUntil // + 1 hour
        );
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

    it('should deploy and handle balance', async () => {
        const deployResult = await deploy();

        // TODO: Change this
        expect(await assurer.getBalance()).toStrictEqual(20_000_000_001n);
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: assurer.address,
            deploy: true,
            success: true,
        });
    });

    it('should return correct data', async () => {
        await deploy();
        const fundingData = await assurer.getFundingData();
        expect(fundingData.goal).toStrictEqual(initData.goal);
        expect(fundingData.donateAmount).toStrictEqual(10_000_000_000n);
        expect(fundingData.participantsCount).toStrictEqual(initData.participantsCount);
        expect(fundingData.donatedCounts).toStrictEqual(0);
        expect(fundingData.validUntil).toStrictEqual(initData.validUntil);
        expect(fundingData.donators).toBeUndefined();
    });

    it('should be active', async () => {
        await deploy();
        expect(await assurer.getIsActive()).toBeTruthy();
    });

    it('should not be active', async () => {
        await deploy();
        expect(await assurer.getIsActive()).toBeTruthy();
        blockchain.now = Math.ceil(Date.now() / 1000) + 60 * 60; // + 1 hour
        expect(await assurer.getIsActive()).toBeFalsy();
    });

    it('should donate', async () => {
        await deploy();
        let fundingData = await assurer.getFundingData();
        const result = await assurer.sendDonate(
            users[0].getSender(),
            fundingData.donateAmount + fees.donate,
            opcodes.donate,
            0
        );
        fundingData = await assurer.getFundingData();
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: assurer.address,
            success: true
        });
        expect(fundingData.donatedCounts).toStrictEqual(1);
    });

    it('handle double donation & while inactive', async () => {
        await deploy();
        let fundingData = await assurer.getFundingData();
        let result = await assurer.sendDonate(
            users[0].getSender(),
            fundingData.donateAmount + fees.donate,
            opcodes.donate,
            0
        );
        fundingData = await assurer.getFundingData();
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: assurer.address,
            success: true
        });
        expect(fundingData.donatedCounts).toStrictEqual(1);

        result = await assurer.sendDonate(
            users[0].getSender(),
            fundingData.donateAmount + fees.donate,
            opcodes.donate,
            0
        );
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: assurer.address,
            success: false,
            exitCode: errors.alreadyDonated
        });

        blockchain.now = Math.ceil(Date.now() / 1000) + 60 * 60; // + 1 hour
        result = await assurer.sendDonate(
            users[0].getSender(),
            fundingData.donateAmount + fees.donate,
            opcodes.donate,
            0
        );
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: assurer.address,
            success: false,
            exitCode: errors.notActive
        });
    });

    it('minimal msg value for donate', async () => {
        await deploy();
        let fundingData = await assurer.getFundingData();
        let result = await assurer.sendDonate(
            users[0].getSender(),
            fundingData.donateAmount + fees.donate - 1n,
            opcodes.donate,
            0
        );
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: assurer.address,
            success: false,
            exitCode: errors.notEnoughDonate
        });

        result = await assurer.sendDonate(
            users[0].getSender(),
            fundingData.donateAmount + fees.donate,
            opcodes.donate,
            0
        );
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: assurer.address,
            success: true
        });
    });

    it('funding completed', async () => {
        await deploy();
        const balance = await assurer.getBalance();
        let fundingData = await assurer.getFundingData();
        for(let i = 0; i < 10; i++) {
            await assurer.sendDonate(
                users[i].getSender(),
                fundingData.donateAmount + fees.donate,
                opcodes.donate,
                0
            );
        }

        fundingData = await assurer.getFundingData();
        expect(fundingData.donatedCounts).toStrictEqual(10);
        expect(fundingData.donators!.size).toStrictEqual(10);
        const isActive = await assurer.getIsActive();
        expect(isActive).toBeFalsy();
        expect(await assurer.getBalance()).toStrictEqual(balance + fundingData.donateAmount * 10n);
        console.log(fundingData.donators)
    });
});
