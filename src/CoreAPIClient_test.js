const assert = require("assert").strict
const http = require("http")
const CoreAPIClient = require("./CoreAPIClient")

const TEST_SERVER_PORT = 51843

async function getSessionToken() {
    return "YQoijTHJOwt4y8bPtPmLNFpbS2TT8C3SmL6WP9QCGJjlH7iyaxyTBKGJHG5KE8eu"
}

describe("CoreAPIClient", () => {
    let server
    let apiClient
    let requests

    before((done) => {
        server = http.createServer((request, response) => {
            let body = ""
            request.on("data", (chunk) => body += chunk)
            request.on("end", () => {
                requests.push({
                    accessToken: request.headers.authorization,
                    url: request.url,
                    method: request.method,
                    body: JSON.parse(body)
                })
            })
            response.end()
        })
        server.listen(TEST_SERVER_PORT, (err) => {
            if (err) {
                done(err)
            }
            console.info(`Test server listening on port ${TEST_SERVER_PORT}`)
            done()
        })
    })

    after((done) => {
        server.close(done)
    })

    beforeEach(() => {
        requests = []
        apiClient = new CoreAPIClient(`http://127.0.0.1:${TEST_SERVER_PORT}`, getSessionToken)
    })

    it("setDeployed causes expected POST request", async () => {
        await apiClient.setDeployed("product-id", {
            blockNumber: 0,
            blockIndex: 0,
            ownerAddress: "0x0",
            beneficiaryAddress: "0xF",
            pricePerSecond: 5,
            priceCurrency: "EUR",
            minimumSubscriptionInSeconds: 0
        })

        assert.equal(requests.length, 1)
        assert.deepEqual(requests[0], {
            method: "POST",
            url: "/products/product-id/setDeployed",
            accessToken: "Bearer YQoijTHJOwt4y8bPtPmLNFpbS2TT8C3SmL6WP9QCGJjlH7iyaxyTBKGJHG5KE8eu",
            body: {
                blockNumber: 0,
                blockIndex: 0,
                ownerAddress: "0x0",
                beneficiaryAddress: "0xF",
                pricePerSecond: 5,
                priceCurrency: "EUR",
                minimumSubscriptionInSeconds: 0
            }
        })
    })

    it("setUndeployed causes expected POST request", async () => {
        await apiClient.setUndeployed("product-id", {
            blockNumber: 0,
            blockIndex: 0,
        })

        assert.equal(requests.length, 1)
        assert.deepEqual(requests[0], {
            method: "POST",
            url: "/products/product-id/setUndeployed",
            accessToken: "Bearer YQoijTHJOwt4y8bPtPmLNFpbS2TT8C3SmL6WP9QCGJjlH7iyaxyTBKGJHG5KE8eu",
            body: {
                blockNumber: 0,
                blockIndex: 0
            }
        })
    })
})
