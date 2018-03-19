const Transaction = require("ethereumjs-tx")

function max(a, b) {
    return a > b ? a : b
}

/**
 * Call helper. VERY surprisingly and unlike pre-1.0, web3 doesn't seem to automagically calculate the gas limit
 * @param from address where call is sent from
 * @param tx function call or deployment
 * @returns {Promise<any>} resolves after function call returns with receipt (is in blockchain)
 */
async function sendFrom(from, tx, opts) {
    // send at least baseFee to work around Ganache throwing for gas less than basefee,
    //   EVEN IF that actual transaction ends up consuming precisely what was the gasEstimate
    const baseFee = +new Transaction({ data: tx.encodeABI() }).getBaseFee() + 100000 // extra for good measure
    const gasEstimate = await tx.estimateGas({ from })
    const gas = max(baseFee, gasEstimate)
    let txPromise = tx.send({ from, gas })
    if (opts && opts.verbose) {
        txPromise = txPromise.then(receipt => {
            console.log(receipt)
            return receipt
        })
    }
    return txPromise
}

module.exports = {
    sendFrom
}
