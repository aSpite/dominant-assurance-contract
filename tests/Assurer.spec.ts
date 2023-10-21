import {
    Blockchain,
    SandboxContract,
    SendMessageResult,
    TreasuryContract
} from '@ton-community/sandbox';
import {
    Cell,
    Sender,
    toNano,
    TransactionComputeVm,
    TransactionDescriptionGeneric
} from 'ton-core';
import { Assurer } from '../wrappers/Assurer';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import {CommonMessageInfoInternal} from "ton-core/src/types/CommonMessageInfo";
import {errors, fees, initData} from "../config";

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
        for(let i = 0; i < 501; i++) {
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

        computePhase = await getInitDeployPhase(assurer, deployer.getSender(),
            toNano(51),
            toNano(600),
            toNano(50),
            501,
            Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
        );
        expect(computePhase.exitCode).toStrictEqual(errors.manyParticipants)

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

        expect(await assurer.getBalance()).toStrictEqual(initData.guaranteeAmount + fees.init);
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
                0
            );
        }

        fundingData = await assurer.getFundingData();
        expect(fundingData.donatedCounts).toStrictEqual(10);
        expect(fundingData.donators!.size).toStrictEqual(10);
        const isActive = await assurer.getIsActive();
        expect(isActive).toBeFalsy();
        expect(await assurer.getBalance()).toStrictEqual(balance + fundingData.donateAmount * 10n);
    });

    it('claim + errors', async () => {
        await deploy();
        let fundingData = await assurer.getFundingData();
        for(let i = 0; i < 9; i++) {
            await assurer.sendDonate(
                users[i].getSender(),
                fundingData.donateAmount + fees.donate,
                0
            );
        }

        let result = await assurer.sendClaim(deployer.getSender(), toNano(1), 0);
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: assurer.address,
            success: false,
            exitCode: errors.underfunded
        });
        result = await assurer.sendClaim(users[0].getSender(), toNano(1), 0);
        expect(result.transactions).toHaveTransaction({
            from: users[0].address,
            to: assurer.address,
            success: false,
            exitCode: errors.unauthorized
        });

        await assurer.sendDonate(
            users[9].getSender(),
            fundingData.donateAmount + fees.donate,
            0
        );

        // Sandbox does not return exit code, just throw(string)
        let success = false;
        try {
            await assurer.sendReturn();
            success = true;
        } catch (e) {}

        expect(success).toBeFalsy();

        result = await assurer.sendClaim(deployer.getSender(), toNano(1), 0);
        expect(result.transactions).toHaveTransaction({
            from: assurer.address,
            to: deployer.address,
            success: true,
            inMessageBounced: false
        });
        expect(await assurer.getBalance()).toStrictEqual(0n);
    });

    it('return donates + errors', async () => {
        await deploy();
        let success = false;
        try {
            await assurer.sendReturn();
            success = true;
        } catch (e) {}
        expect(success).toBeFalsy();

        let fundingData = await assurer.getFundingData();
        for(let i = 0; i < 5; i++) {
            await assurer.sendDonate(
                users[i].getSender(),
                fundingData.donateAmount + fees.donate,
                0
            );
        }

        try {
            await assurer.sendReturn();
            success = true;
        } catch (e) {}
        expect(success).toBeFalsy();

        blockchain.now = Math.ceil(Date.now() / 1000) + 60 * 60; // + 1 hour
        const result = await assurer.sendReturn();
        expect(result.transactions).toHaveTransaction({
            to: assurer.address,
            success: true,
        });
        for(let i = 0; i < 5; i++) {
            expect(result.transactions).toHaveTransaction({
                from: assurer.address,
                to: users[i].address,
                success: true,
                op: 0x85d32319
            });
        }
        expect(result.transactions).toHaveTransaction({
            from: assurer.address,
            to: deployer.address,
            success: true
        });
        expect(await assurer.getBalance()).toStrictEqual(0n);
    });

    it('499 donates + return', async () => {
        let result = await assurer.sendDeploy(deployer.getSender(),
            toNano(150),
            toNano(1000),
            toNano(100),
            500,
            initData.validUntil
        );

        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: assurer.address,
            deploy: true,
            success: true,
        });

        let fundingData = await assurer.getFundingData();
        let snapshot = blockchain.snapshot();
        for(let i = 0; i < 500; i++) {
            result = await assurer.sendDonate(
                users[i].getSender(),
                fundingData.donateAmount + toNano(1),
                0
            );

            if(i == 498)
                snapshot = blockchain.snapshot();

            // calculating compute fees for donate
            if(i == 499) {
                console.log(fundingData.donateAmount)
                // printTransactionFees(result.transactions)
                console.log(result.transactions[1].description)
                // 13 700 000n = 0.0137 TON
            }
        }

        fundingData = await assurer.getFundingData();
        for(let i = 0; i < 500; i++) {
            expect(fundingData.donators!.has(users[i].address)).toBeTruthy();
        }

        blockchain.now = Math.ceil(Date.now() / 1000) + 68 * 60 * 24 * 365; // + 1 year
        result = await assurer.sendDonate(
            users[0].getSender(),
            fundingData.donateAmount + toNano(1),
            0
        );
        // calculating storage fees
        console.log(
            (result.transactions[1].description as TransactionDescriptionGeneric)
                .storagePhase!.storageFeesCollected
        )
        // 352 260 890n = 0.352260 TON

        await blockchain.loadFrom(snapshot);
        blockchain.now = Math.ceil(Date.now() / 1000) + 60 * 60; // + 1 hour
        result = await assurer.sendReturn();
        console.log(await assurer.getBalance());
        console.log((result.transactions[503].inMessage!.info as CommonMessageInfoInternal).value.coins)
        // 3 042 030 713n = 3.042030 TON
    });

    it('500 donates + claim', async () => {
        await assurer.sendDeploy(deployer.getSender(),
            toNano(150),
            toNano(1000),
            toNano(100),
            500,
            initData.validUntil
        );
        const balance = await assurer.getBalance();

        let fundingData = await assurer.getFundingData();
        let storageFees = 0n;
        for(let i = 0; i < 500; i++) {
            const result = await assurer.sendDonate(
                users[i].getSender(),
                fundingData.donateAmount + fees.donate,
                0
            );

           storageFees += (result.transactions[1].description as TransactionDescriptionGeneric)
               .storagePhase!.storageFeesCollected;
        }

        let result = await assurer.sendDonate(
            users[500].getSender(),
            fundingData.donateAmount + fees.donate,
            0
        );
        expect(result.transactions).toHaveTransaction({
            from: users[500].address,
            to: assurer.address,
            success: false,
            exitCode: errors.notActive
        });

        fundingData = await assurer.getFundingData();
        for(let i = 0; i < 500; i++) {
            expect(fundingData.donators!.has(users[i].address)).toBeTruthy();
        }
        expect(fundingData.donatedCounts).toStrictEqual(500);
        expect(fundingData.donators!.size).toStrictEqual(500);
        expect(await assurer.getIsActive()).toBeFalsy();
        expect(await assurer.getBalance()).toStrictEqual(balance + fundingData.donateAmount * 500n - storageFees);

        result = await assurer.sendClaim(deployer.getSender(), toNano(1), 0);
        expect(result.transactions).toHaveTransaction({
            from: assurer.address,
            to: deployer.address,
            success: true,
            inMessageBounced: false
        });
        expect(await assurer.getBalance()).toStrictEqual(0n);
        expect((result.transactions[2].inMessage!.info as CommonMessageInfoInternal).value.coins)
            .toBeGreaterThan(balance + fundingData.donateAmount * 500n - storageFees);
    });
});
