const log = require("./log")
const fs = require("fs")

const filename = "/lastBlock"

class LastBlockStore {
    constructor(lastBlockDirPath) {
        if (lastBlockDirPath === null) {
            this.lastBlockPath = "."  + filename
        } else {
            this.lastBlockPath = lastBlockDirPath + filename
        }
    }

    write(blockNumber) {
        try {
            fs.writeFileSync(this.lastBlockPath, blockNumber)
            log.info(`Processed https://etherscan.io/block/${blockNumber}. Wrote ${this.lastBlockPath}.`)
        } catch (e) {
            log.error(`Error while writing ${this.lastBlockPath} file: ${e.message}`)
        }
    }

    read() {
        let blockNumber
        try {
            const buffer = fs.readFileSync(this.lastBlockPath)
            blockNumber = parseInt(buffer.toString())
        } catch (e) {
            log.info(`No ${this.lastBlockPath} file found. Start from block zero.`)
            return 0
        }
        return blockNumber
    }
}

module.exports = LastBlockStore