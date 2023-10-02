import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode
} from 'ton-core';

export type AssurerConfig = {
    createdTime: number
    authorAddress: Address
};

export type FundingData = {
    goal: bigint,
    donateAmount: bigint,
    participantsCount: number,
    donatedCounts: number,
    validUntil: number,
    donators: Dictionary<Address, Cell> | undefined
}

export function assurerConfigToCell(config: AssurerConfig): Cell {
    return beginCell()
        .storeUint(config.createdTime, 32)
        .storeAddress(config.authorAddress)
        .endCell();
}

export class Assurer implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Assurer(address);
    }

    static createFromConfig(config: AssurerConfig, code: Cell, workchain = 0) {
        const data = assurerConfigToCell(config);
        const init = { code, data };
        return new Assurer(contractAddress(workchain, init), init);
    }

    async sendDeploy(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        goal: bigint,
        guaranteeAmount: bigint,
        participantsCount: number,
        validUntil: number
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeCoins(goal)
                .storeCoins(guaranteeAmount)
                .storeUint(participantsCount, 8)
                .storeUint(validUntil, 32)
                .endCell(),
        });
    }

    async getFundingData(provider: ContractProvider): Promise<FundingData> {
        const result = await provider.get('get_funding_data', []);
        return {
            goal: result.stack.readBigNumber(),
            donateAmount: result.stack.readBigNumber(),
            participantsCount: result.stack.readNumber(),
            donatedCounts: result.stack.readNumber(),
            validUntil: result.stack.readNumber(),
            donators: result.stack.readCellOpt()?.beginParse().loadDictDirect(Dictionary.Keys.Address(), Dictionary.Values.Cell())
        }
    }

    async getIsActive(provider: ContractProvider): Promise<boolean> {
        const result = await provider.get('is_active', []);
        return result.stack.readBoolean();
    }

    async getBalance(provider: ContractProvider) {
        const state = await provider.getState();
        return state.balance;
    }
}
