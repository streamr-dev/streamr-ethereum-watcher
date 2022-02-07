import {strict as assert} from "assert"
import {getEnv} from "./env"

describe("OS environment variables", () => {
    it("gets variable from environment", () => {
        process.env.TEST_VAR = "hello"
        assert.equal(getEnv("TEST_VAR"), "hello")
    })
    it("undefined variable returns empty string", () => {
        delete process.env.TEST_VAR
        assert.equal(process.env.TEST_VAR, undefined)
        assert.equal(getEnv("TEST_VAR"), "")
    })
})
