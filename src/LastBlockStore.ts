import log from "./log"
import fs from "fs"

const filename = "/lastBlock"

export default class LastBlockStore {
    private readonly lastBlockPath: string

    constructor(lastBlockDirPath: string) {
        if (lastBlockDirPath === null) {
            this.lastBlockPath = "."  + filename
        } else {
            this.lastBlockPath = lastBlockDirPath + filename
        }
    }

    write(blockNumber: number): void {
        log.info(`LastBlockStore about to write ${blockNumber}`)
        try {
            fs.writeFileSync(this.lastBlockPath, blockNumber.toString())
            log.info(`Processed https://etherscan.io/block/${blockNumber}. Wrote ${this.lastBlockPath}.`)
        } catch (e: any) {
            log.error(`Error while writing ${this.lastBlockPath} file: ${e}`)
        }
    }

    read(): number {
        let blockNumber
        try {
            const buffer = fs.readFileSync(this.lastBlockPath)
            blockNumber = parseInt(buffer.toString())
        } catch (e: any) {
            log.info(`No ${this.lastBlockPath} file found. Start from block zero.`)
            return 0
        }
        return blockNumber
    }
}
