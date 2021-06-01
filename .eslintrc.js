module.exports = {
    "env": {
        "node": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2017
    },
    "rules": {
        "indent": [
            "error",
            4,
            {
                "SwitchCase": 1,
                "flatTernaryExpressions": true
            },
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "never"
        ],
        "no-console": "warn",
        "keyword-spacing": "error",
        "func-call-spacing": "error",
        "space-infix-ops": "error"
    },
    "globals": {
        "describe": "readonly",
        "it": "readonly",
        "before": "readonly",
        "beforeEach": "readonly",
        "after": "readonly",
        "afterEach": "readonly",
    },
    "overrides": [
        {
            "files": ["src/*_test.js"],
            "rules": {
                "no-console": 0,
            }
        }
    ]
}
