/**
 * Call helper. VERY surprisingly and unlike pre-1.0, web3 doesn't seem to automagically calculate the gas limit
 * @param from address where call is sent from
 * @param tx function call or deployment
 * @returns {Promise<any>} resolves after function call returns with receipt (is in blockchain)
 */
async function sendFrom(from, tx) {
    return tx.send({
        from,
        gas: await tx.estimateGas()
    })
}

module.exports = {
    sendFrom
}
