import assert from "assert"
import { spawn } from "child_process"
import type { ChildProcess } from "child_process"

import { Contract, Wallet } from "ethers"
import { JsonRpcProvider } from "ethers/providers"
import { ContractReceipt } from "ethers/contract"
import { getAddress, parseEther, formatEther } from "ethers/utils"

import { networks } from "@streamr/config"

import TokenJson from "../lib/marketplace-contracts/build/contracts/MintableToken.json"
import MarketplaceJson from "../lib/marketplace-contracts/build/contracts/Marketplace.json"
import StreamRegistryJson from "../lib/streamregistry/StreamRegistryV3.json"

import type { StreamRegistryV3 } from "../lib/types/StreamRegistryV3"

import CoreAPIClient from "../src/CoreAPIClient"

const { log } = console
// enum PermissionType { Edit, Delete, Publish, Subscribe, Grant }

const {
    dev0: {
        id: networkId,
        rpcEndpoints: [{
            url: ETHEREUM_SERVER_URL,
        }],
        contracts: {
            DATA: dataTokenAddress,
            Marketplace: MARKETPLACE_ADDRESS,
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
const prefundedKey = "0xe5af7834455b7239881b85be89d905d6881dcb4751063897f12be1b0dd546bdb"

const STREAMR_API_URL = "http://10.200.10.1/api/v2"

const watcherEnv: NodeJS.ProcessEnv = {
    STREAM_REGISTRY_ADDRESS,
    MARKETPLACE_ADDRESS,
    NETWORK_ID: networkId.toString(),
    ETHEREUM_SERVER_URL,
    MATIC_SERVER_URL,
    STREAMR_API_URL,
    DEVOPS_KEY,
    LAST_BLOCK_DIR: ".",
}
const watcherExecutable = "dist/src/main.js"

const provider = new JsonRpcProvider(ETHEREUM_SERVER_URL)
const watcherWallet = new Wallet(DEVOPS_KEY, provider)
const wallet = new Wallet(adminKey, provider)

const sidechainProvider = new JsonRpcProvider(MATIC_SERVER_URL)
const sidechainWallet = new Wallet(adminKey, sidechainProvider)

const tokenAddress = getAddress(dataTokenAddress)
const marketAddress = getAddress(MARKETPLACE_ADDRESS)
const registryAddress = getAddress(STREAM_REGISTRY_ADDRESS)

const token = new Contract(tokenAddress, TokenJson.abi, wallet)
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
const trustedApiClient = new CoreAPIClient(
    STREAMR_API_URL,
    CoreAPIClient.DEFAULT_FETCH_FUNC,
    CoreAPIClient.DEFAULT_GET_SESSION_TOKEN_FUNC,
    DEVOPS_KEY
)

/**
 * Resolves the promise once stream contains a match for target regex
 * @param {Readable} stream to subscribe to
 * @param {RegExp} regex to use for matching
 * @returns {Match} the regex match object
 */
async function untilStreamMatches(stream: NodeJS.ReadableStream, regex: RegExp): Promise<RegExpMatchArray | null> {
    return new Promise((resolve) => {
        function check(buffer: Buffer) {
            const data = buffer.toString()
            const match = data.match(regex)
            if (match) {
                if (stream.off) { stream.off("data", check) }
                resolve(match)
            }
        }
        stream.on("data", check)
    })
}

async function sleep(time: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, time)
    })
}

describe("Watcher", () => {

    let productId: string
    let productIdBytes: string
    before(async function () {
        this.timeout(30000)

        // fund the devops key
        const fundTx1 = await wallet.sendTransaction({
            to: watcherWallet.address,
            value: parseEther("1000")
        })
        await fundTx1.wait()
        log("Watcher balance mainnet: %s", formatEther(await watcherWallet.getBalance()))

        const fundTx2 = await sidechainWallet.sendTransaction({
            to: watcherWallet.address,
            value: parseEther("1000")
        })
        await fundTx2.wait()
        log("Watcher balance sidechain: %s", formatEther(await sidechainProvider.getBalance(watcherWallet.address)))

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
        productId = createResJson.id
        productIdBytes = "0x" + productId

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
            watcherWallet.address,
            1,  // pricePerSecond
            0,  // DATA
            1   // minimumSubscriptionSeconds
        )
        log("Creating product %s", productId)
        const createTr = await createTx.wait()

        // set it deployed (simulate watcher)
        // @ts-ignore-next-line re-use private code
        const deployRes = await trustedApiClient._post(`${STREAMR_API_URL}/products/${productId}/setDeployed`, {
            blockNumber: createTr.blockNumber,
            blockIndex: createTr.transactionIndex,
            beneficiaryAddress: watcherWallet.address,
            description: "Testing!",
            name: "Test",
            ownerAddress: watcherWallet.address,
            minimumSubscriptionInSeconds: 1,
            pricePerSecond: 1,
            priceCurrency: "DATA",
            category: "1"
        })
        log("Set deployed in core-api: %o", await deployRes.json())
    })

    let watcherProcess: ChildProcess | undefined
    beforeEach(async function () {
        this.timeout(10000)
        if (watcherProcess) { return }
        log(Object.keys(watcherEnv).map((k) => k + "=" + watcherEnv[k] + " ").join("") + watcherExecutable)
        log(process.execPath)
        watcherProcess = spawn(process.execPath, [watcherExecutable], { env: watcherEnv })
        if (!watcherProcess.stdout || !watcherProcess.stderr) { throw new Error("No stdout/stderr in spawned process") }
        watcherProcess.stdout.on("data", (data) => { log(`(server stdout) ${data.toString().trim()}`) })
        watcherProcess.stderr.on("data", (data) => { log(`(server stderr) ${data.toString().trim()}`) })
        watcherProcess.on("close", (code) => { log(`server exited with code ${code}`) })
        watcherProcess.on("error", (err) => { log(`server ERROR: ${err}`) })

        // wait until server is started, also get url from output
        await untilStreamMatches(watcherProcess.stdout, /Playback done. Starting watcher.../)
    })

    afterEach(() => {
        if (watcherProcess) {
            watcherProcess.kill()
            watcherProcess = undefined
        }
    })

    it("notices a purchase on the docker-dev Marketplace", async function () {
        this.timeout(300000)
        if (!watcherProcess?.stdout) { throw new Error("Watcher process not initialized yet") }

        const buyerWallet = new Wallet(prefundedKey, provider)
        log("Minting tokens")
        const mintTx = await token.mint(buyerWallet.address, parseEther("10000"))
        await mintTx.wait()
        log("Adding approval")
        const approveTx = await token.connect(buyerWallet).approve(market.address, parseEther("100"))
        await approveTx.wait()

        // this has to be long enough that the event gets registered by the watcher,
        //   otherwise no update will be done because "already old" subscriptions aren't sent to registry
        const subscriptionSeconds = 10

        // execute many purchases: In production, I've had first buy get noticed, and subsequent one(s) fail.
        for (let i = 0; i < 5; i++) {
            const buyTx = await market.connect(buyerWallet).buy(productIdBytes, subscriptionSeconds.toString())
            log("Sending %s/10: market.buy(%s, %s) from %s", i + 1, productId, subscriptionSeconds, buyerWallet.address)
            const [buyTr] = await Promise.all([
                buyTx.wait(),
                untilStreamMatches(watcherProcess.stdout, /trustedSetPermissions receipt/)]
            ) as [ContractReceipt, any]
            const buyEvents = buyTr?.events?.map((e) => e?.event || "").filter(x => x !== "") || []
            log("Buy transaction emitted events: %o", buyEvents)
            assert.deepStrictEqual(buyEvents, ["NewSubscription", "Subscribed"])
            await sleep(subscriptionSeconds * 1500) // should sleep long enough that the subscription expires
        }
    })
})
