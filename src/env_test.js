const assert = require("assert").strict
const {getEnv} = require("./env")

describe("OS environment variables", () => {
    it("gets variable from environment", () => {
        process.env.TEST_VAR = "hello"
        assert.equal(getEnv("TEST_VAR"), "hello")
    })
    it("undefined variable is null", () => {
        process.env.TEST_VAR = undefined
        assert.equal(getEnv("TEST_VAR"), "")
    })
})
