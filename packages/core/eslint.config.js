import tsParser from "@typescript-eslint/parser";

/**
 * Enforces the core's most important architectural rule: nothing in the core
 * may import a plugin, directly or transitively.
 */
export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@terrascope/plugin-*",
                "!@terrascope/plugin-api",
                "!@terrascope/plugin-api/*",
                "**/plugins/*",
                "../../plugins/*",
              ],
              message: "The core must never depend on a plugin.",
            },
          ],
        },
      ],
    },
  },
];
