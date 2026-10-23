import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["worker-configuration.d.ts", ".wrangler/**"] }, ...tseslint.configs.recommended);
