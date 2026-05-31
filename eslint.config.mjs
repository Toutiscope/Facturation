import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // Fichiers/dossiers à ignorer
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dist-electron/**",
      "out/**",
      "data/**",
      "build/**",
    ],
  },

  // Règles JS recommandées
  js.configs.recommended,

  // Règles Vue 3 recommandées (parse les .vue)
  ...pluginVue.configs["flat/recommended"],

  // Réglages communs à tout le code source
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
      // L'IDE (WebStorm) ne supporte pas la syntaxe ES2022 Error(message, { cause }) ;
      // on garde donc les throw à un seul argument (l'erreur d'origine est déjà loggée).
      "preserve-caught-error": "off",
    },
  },

  // Process principal & preload Electron → environnement Node
  {
    files: ["src/main/**/*.js", "src/preload/**/*.js", "*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Renderer Vue → environnement navigateur
  {
    files: ["src/renderer/**/*.{js,vue}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Les composants de page/vue portent légitimement un nom d'un seul mot
  {
    files: ["src/renderer/views/**/*.vue"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },

  // Tests Vitest
  {
    files: ["**/__tests__/**/*.js", "**/*.{test,spec}.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },

  // Désactive les règles ESLint en conflit avec Prettier (doit rester en dernier)
  prettier,
];
