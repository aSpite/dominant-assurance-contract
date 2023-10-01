import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type AssurerConfig = {};

export function assurerConfigToCell(config: AssurerConfig): Cell {
    return beginCell().endCell();
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

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
