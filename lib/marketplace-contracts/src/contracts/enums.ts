const ProductState = {
    NotDeployed: 0,                // non-existent or deleted
    Deployed: 1                    // created or redeployed
}
const Currency = {
    DATA: 0,                       // data atoms or "wei" (10^-18 DATA)
    USD: 1                         // nanodollars (10^-9 USD)
}

export default {
    ProductState,
    Currency,

    // inverses
    currencySymbol: Object.getOwnPropertyNames(Currency),
    productStateName: Object.getOwnPropertyNames(ProductState)
}
