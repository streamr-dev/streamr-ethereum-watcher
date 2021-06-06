module.exports = {
    "env": {
        "node": true,
        "es6": true
    },
    "parser": "@typescript-eslint/parser",
    "plugins": [
        "@typescript-eslint"
    ],
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "parserOptions": {
        "project": "./tsconfig.json",
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
        "no-console": "error",
        "keyword-spacing": "error",
        "func-call-spacing": "error",
        "space-infix-ops": "error",
        "no-throw-literal": "error",
        "no-async-promise-executor": "error",
        "no-promise-executor-return": "error",
        "prefer-promise-reject-errors": "error",
        "@typescript-eslint/no-unused-vars": [
            "warn", //"error",
            {
                //"argsIgnorePattern": "^_",
                //"caughtErrors": "all",
                //"caughtErrorsIgnorePattern": "^ignore"
            }
        ],
        "@typescript-eslint/no-floating-promises": ["error"],
        "@typescript-eslint/promise-function-async": [
            "error",
            {
                "allowedPromiseNames": ["Thenable"],
                "checkArrowFunctions": true,
                "checkFunctionDeclarations": true,
                "checkFunctionExpressions": true,
                "checkMethodDeclarations": true,
            }
        ],
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
            "files": ["src/*_test.ts"],
            "rules": {
                "no-console": 0,
            }
        }
    ]
}
