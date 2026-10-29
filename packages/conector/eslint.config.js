import tseslint from "typescript-eslint";

// O dist/ é o pacote gerado pelo tsup, não fonte.
export default tseslint.config({ ignores: ["dist/"] }, ...tseslint.configs.recommended);
