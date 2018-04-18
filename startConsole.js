// Helper functions for an "ethereum console", similar to geth --attach

var _ = require("lodash")
var Table = require("cli-table")
var BN = require("bignumber.js")

const argv = require("yargs").argv

const Web3 = require("web3")
const web3 = new Web3(argv.ethereumServerURL || argv.server || "wss://rinkeby.infura.io/ws")

const repl = require('repl')
const ctx = repl.start().context

ctx.web3 = web3
ctx.lo = _
ctx.e = web3.eth
ctx.N = x => new BN(x) 

ctx.accounts = []
web3.eth.getAccounts().then(acc => { ctx.accounts = acc })

ctx.B = function (i) { return web3.eth.getBalance(ctx.accounts[i]) }
ctx.b = function (i) { return web3.fromWei(web3.eth.getBalance(ctx.accounts[i]), "ether") }
ctx.BB = function () { return ctx.accounts.map((a) => { return web3.eth.getBalance(a) }) }
ctx.bb = function () { return ctx.accounts.map((a) => { return web3.fromWei(web3.eth.getBalance(a), "ether") }) }

ctx.move = function (fromI, toI, eth) {
    const args = {
        from: ctx.accounts[fromI],
        to: ctx.accounts[toI],
        value: web3.toWei(eth, "ether")
    }
    return web3.eth.sendTransaction(args)
}

ctx.list = function () {
    const balances = ctx.bb()
    const n = ctx.accounts.length
    const rows = _.zip(_.range(n), ctx.accounts, balances)

    var table = new Table({
        head: ["#", "Address", "ETH"]
    })
    table.length = n
    _.assign(table, rows)

    console.log(table.toString())
}

//ctx.debug = require("./src/transactionTrace")
