export const errors = {
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
    stillActive: 112,
    noDonators: 113,
    fundingEnded: 114
};

export const initData = {
    value: 25_000_000_000n,
    goal: 100_000_000_000n,
    guaranteeAmount: 20_000_000_000n,
    participantsCount: 10,
    validUntil: Math.ceil(Date.now() / 1000) + 60 * 60 // + 1 hour
};

export const fees = {
    init: 4_000_000_000n,
    donate: 20_000_000n
}