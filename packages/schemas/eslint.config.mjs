import { defineConfig } from "eslint/config"
import tsParser from "@typescript-eslint/parser"

export default defineConfig([
  {
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
])
