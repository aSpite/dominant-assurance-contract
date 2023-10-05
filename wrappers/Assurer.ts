import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    DictionaryValue,
    Sender,
    SendMode,
    Slice
} from 'ton-core';

export type AssurerConfig = {
    createdTime: number
    authorAddress: Address
};

export type FundingData = {
    goal: bigint,
    donateAmount: bigint,
    guaranteeAmount: bigint,
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

function createEmptyValue(): DictionaryValue<Cell> {
    return {
        serialize: (src: any, buidler: any) => {
        },
        parse: (src: Slice) => {
            return Cell.EMPTY
        }
    }
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
                .storeUint(participantsCount, 16)
                .storeUint(validUntil, 32)
                .endCell(),
        });
    }

    async sendDonate(provider: ContractProvider, via: Sender, value: bigint, queryID: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x6e89546a, 32)
                .storeUint(queryID, 64)
                .endCell()
        });
    }

    async sendClaim(provider: ContractProvider, via: Sender, value: bigint, queryID: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x6d7ae559, 32)
                .storeUint(queryID, 64)
                .endCell()
        });
    }

    async sendReturn(provider: ContractProvider) {
        await provider.external(beginCell().endCell());
    }

    async getFundingData(provider: ContractProvider): Promise<FundingData> {
        const result = await provider.get('get_funding_data', []);
        return {
            goal: result.stack.readBigNumber(),
            donateAmount: result.stack.readBigNumber(),
            guaranteeAmount: result.stack.readBigNumber(),
            participantsCount: result.stack.readNumber(),
            donatedCounts: result.stack.readNumber(),
            validUntil: result.stack.readNumber(),
            donators: result.stack.readCellOpt()?.beginParse().loadDictDirect(Dictionary.Keys.Address(), createEmptyValue())
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
