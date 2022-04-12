// for manual testing: create a stream and add it to a product on POLYGON marketplace

import { Contract, Wallet } from "ethers"
import { JsonRpcProvider } from "ethers/providers"

import MarketplaceJson from "../lib/marketplace-contracts/build/contracts/Marketplace.json"
import StreamRegistryJson from "../lib/streamregistry/StreamRegistryV3.json"
import { getAddress } from "ethers/utils"

import type { StreamRegistryV3 } from "../lib/types/StreamRegistryV3"

import CoreAPIClient from "../src/CoreAPIClient"

const { log } = console

import { Chains } from "@streamr/config"

const {
    polygon: {
        rpcEndpoints: [{
            url: MATIC_SERVER_URL,
        }],
        contracts: {
            "Marketplace": MARKETPLACE_ADDRESS = "0x058fbb3cf628ee51ce8864c9ee8350f81e495a7d",
            "StreamRegistry": STREAM_REGISTRY_ADDRESS,
        }
    }
} = Chains.load("production")

const key = "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"

const STREAMR_API_URL = "https://streamr.network/api/v2"

const provider = new JsonRpcProvider(MATIC_SERVER_URL)
const wallet = new Wallet(key, provider)

const marketAddress = getAddress(MARKETPLACE_ADDRESS)
const registryAddress = getAddress(STREAM_REGISTRY_ADDRESS)

const market = new Contract(marketAddress, MarketplaceJson.abi, wallet)
const registry = new Contract(registryAddress, StreamRegistryJson.abi, wallet) as unknown as StreamRegistryV3

const streamIdPath = "/test" + Date.now()
const streamId = wallet.address.toLowerCase() + streamIdPath

const ownerApiClient = new CoreAPIClient(
    STREAMR_API_URL,
    CoreAPIClient.DEFAULT_FETCH_FUNC,
    CoreAPIClient.DEFAULT_GET_SESSION_TOKEN_FUNC,
    key
)

async function main() {
    const streamTx = await registry.createStream(streamIdPath, "{}")
    log("Creating stream %s", streamId)
    const streamTr = await streamTx.wait()
    log("Events: %o", streamTr.events)

    // create product into the core-api (simulate marketplace)
    // @ts-ignore-next-line re-use private code
    const createRes = await ownerApiClient._post(`${STREAMR_API_URL}/products/`, {
        type: "DATAUNION",
        state: "NOT_DEPLOYED",
        beneficiaryAddress: wallet.address,
        dataUnionVersion: 2
    })
    const createResJson = await createRes.json()
    log("Created product in core-api: %o", createResJson)
    const productId = createResJson.id
    const productIdBytes = "0x" + productId

    // add stream to product
    const streamIdEncoded = encodeURIComponent(streamId)
    let status = 0
    do {
        // @ts-ignore-next-line re-use private code
        const addRes = await ownerApiClient._post(`${STREAMR_API_URL}/products/${productId}/streams/${streamIdEncoded}`, {}, "PUT")
        log("Add stream to product returned %s %s", addRes.status, addRes.statusText)
        status = addRes.status
    } while (status !== 204)

    // createProduct(bytes32 id, string memory name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds) public whenNotHalted {
    const createTx = await market.createProduct(
        productIdBytes,
        "End-to-end tester",
        wallet.address,
        1,  // pricePerSecond
        0,  // DATA
        1   // minimumSubscriptionSeconds
    )
    log("Creating product %s", productId)
    const createTr = await createTx.wait()

    log("Create receipt: %o", createTr)

    // expect to see in watcher log: Product f640d5322ae246ac8abc19e722c8c26dd5b8a53ea36848e7b6e8fff1f121b58e deployed
}
main().catch(console.error)
