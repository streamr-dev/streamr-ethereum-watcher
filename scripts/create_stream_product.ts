// for manual testing: create a stream and add it to a product
// Usage: first set watcher running (src/main.ts), then run this

import { Contract, Wallet } from "ethers"
import { JsonRpcProvider } from "ethers/providers"

import MarketplaceJson from "../lib/marketplace-contracts/build/contracts/MarketplaceV3.json"
import StreamRegistryJson from "../lib/streamregistry/StreamRegistryV3.json"
import { getAddress } from "ethers/utils"

import type { StreamRegistryV3 } from "../lib/types/StreamRegistryV3"

import CoreAPIClient from "../src/CoreAPIClient"

const { log } = console

import { networks } from "@streamr/config"

const {
    dev0: {
        rpcEndpoints: [{
            url: ETHEREUM_SERVER_URL,
        }],
        contracts: {
            DATA: TOKEN_ADDRESS,
            MarketplaceV3: MARKETPLACE_ADDRESS,
        }
    },
    dev1: {
        rpcEndpoints: [{
            url: MATIC_SERVER_URL,
        }],
        contracts: {
            StreamRegistry: STREAM_REGISTRY_ADDRESS,
        }
    }
} = networks

const DEVOPS_KEY = "0x628acb12df34bb30a0b2f95ec2e6a743b386c5d4f63aa9f338bec6f613160e78" // 0xa12Ccb60CaD03Ce838aC22EaF2Ce9850736F154f
const adminKey = "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0" // 0xa3d1f77acff0060f7213d7bf3c7fec78df847de1

const STREAMR_API_URL = "http://10.200.10.1/api/v2"

const provider = new JsonRpcProvider(ETHEREUM_SERVER_URL)
const watcherWallet = new Wallet(DEVOPS_KEY, provider)
const wallet = new Wallet(adminKey, provider)

const sidechainProvider = new JsonRpcProvider(MATIC_SERVER_URL)
const sidechainWallet = new Wallet(adminKey, sidechainProvider)

const marketAddress = getAddress(MARKETPLACE_ADDRESS)
const registryAddress = getAddress(STREAM_REGISTRY_ADDRESS)

const market = new Contract(marketAddress, MarketplaceJson.abi, wallet)
const registry = new Contract(registryAddress, StreamRegistryJson.abi, sidechainWallet) as unknown as StreamRegistryV3

const streamIdPath = "/test" + Date.now()
const streamId = wallet.address.toLowerCase() + streamIdPath

const ownerApiClient = new CoreAPIClient(
    STREAMR_API_URL,
    CoreAPIClient.DEFAULT_FETCH_FUNC,
    CoreAPIClient.DEFAULT_GET_SESSION_TOKEN_FUNC,
    adminKey
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
        beneficiaryAddress: watcherWallet.address,
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

    // function createProduct(bytes32 id, string memory name, address beneficiary, uint pricePerSecond, address pricingToken, uint minimumSubscriptionSeconds)
    const createTx = await market.createProduct(
        productIdBytes,
        "End-to-end tester",
        watcherWallet.address,
        1,  // pricePerSecond
        TOKEN_ADDRESS,
        1   // minimumSubscriptionSeconds
    )
    log("Creating product %s", productId)
    const createTr = await createTx.wait()

    log("Create receipt: %o", createTr)

    // expect to see in watcher log: Product f640d5322ae246ac8abc19e722c8c26dd5b8a53ea36848e7b6e8fff1f121b58e deployed
}
main().catch(console.error)
