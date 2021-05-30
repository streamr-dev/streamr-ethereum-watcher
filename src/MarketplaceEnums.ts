export enum ProductState {
    NotDeployed = 0, // non-existent or deleted
    Deployed = 1, // created or redeployed
}
export enum Currency {
    DATA = 0, // data atoms or "wei" (10^-18 DATA)
    USD = 1, // nanodollars (10^-9 USD)
}
export const CurrencySymbol = Object.getOwnPropertyNames(Currency)
export const ProductStateName = Object.getOwnPropertyNames(ProductState)
