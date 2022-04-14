import { Wallet, providers, utils } from "ethers"

const { JsonRpcProvider } = providers
const { parseEther } = utils

import { Chains } from "@streamr/config"

const { log } = console

const {
    ethereum: {
        rpcEndpoints: [{
            url: ETHEREUM_SERVER_URL,
        }],
    },
    streamr: {
        rpcEndpoints: [{
            url: maticServerURL,
        }],
    },
} = Chains.load("development")

const prefundedKey = "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0" // 0xa3d1f77acff0060f7213d7bf3c7fec78df847de1
const DEVOPS_KEY = "0x628acb12df34bb30a0b2f95ec2e6a743b386c5d4f63aa9f338bec6f613160e78" // 0xa12Ccb60CaD03Ce838aC22EaF2Ce9850736F154f

const provider = new JsonRpcProvider(ETHEREUM_SERVER_URL)
const maticProvider = new JsonRpcProvider(maticServerURL)

const wallet = new Wallet(prefundedKey, provider)
const maticWallet = new Wallet(prefundedKey, maticProvider)
const watcherWallet = new Wallet(DEVOPS_KEY, provider)

async function main() {
    const to = watcherWallet.address // same in both networks

    log("%s mainnet balance: %s", to, (await provider.getBalance(to)).toString())
    const tx = await wallet.sendTransaction({
        to,
        value: parseEther("10")
    })
    const tr = await tx.wait()
    log(tr)
    log("%s mainnet balance: %s", to, (await provider.getBalance(to)).toString())

    log("%s sidechain balance: %s", to, (await maticProvider.getBalance(to)).toString())
    const tx2 = await maticWallet.sendTransaction({
        to,
        value: parseEther("10")
    })
    const tr2 = await tx2.wait()
    log(tr2)
    log("%s sidechain balance: %s", to, (await maticProvider.getBalance(to)).toString())
}
main().catch(console.error)
