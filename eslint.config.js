const js = require("@eslint/js");
const globals = require("globals");
const react = require("eslint-plugin-react");
const tseslint = require("@typescript-eslint/eslint-plugin");

module.exports = [
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  react.configs.flat.recommended,
  ...tseslint.configs["flat/recommended"],
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    settings: {
      react: { version: "detect" },
    },
  },
  {
    // Build and tooling config files run in Node and use require()
    files: ["*.js", "webpack/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/__tests__/**", "**/__mocks__/**", "test/**"],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
