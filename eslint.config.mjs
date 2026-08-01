import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Abandoned Firebase Hosting build output. It is a checked-out Next build
    // and on its own accounts for ~24,700 of the reported lint errors, which
    // buries the real ~90 in src/ and tests/.
    ".firebase/**",
    // Generated / vendored artifacts that are not our source.
    "graphify-out/**",
    "scratch/**",
  ]),
]);

export default eslintConfig;
