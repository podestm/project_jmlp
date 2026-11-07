import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Záměrně úzká konfigurace. Nejde o vkus (odsazení, uvozovky), ale o chyby,
 * které projdou buildem a spadnou až za běhu - a o mrtvý kód.
 *
 * `no-undef` sem patří po konkrétní zkušenosti: při rozdělení velké komponenty
 * zůstalo volání funkce, která se přestěhovala do jiného modulu a nebyla
 * doimportovaná. Build prošel, testy to místo neměly, spadlo by to až v ruce
 * rozhodčího.
 */
export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '18.2' } },
    rules: {
      'no-undef': 'error',
      /**
       * Použití proměnné před její deklarací.
       *
       * Zapnuto po pádu celé sekce časoměřiče: při rozdělování komponenty
       * zůstalo volání hooku nad deklarací refu, který si bere. `no-undef`
       * to nechytí (proměnná v rozsahu existuje), build projde, ale za běhu
       * to shodí render a obrazovka je prázdná.
       *
       * Jen varování: drtivá většina nálezů jsou volání uvnitř useEffect,
       * který běží až po vykreslení, takže jsou neškodná. Skutečnou pojistkou
       * proti pádu je test, který obrazovky vykreslí (src/test/screens.test.jsx).
       */
      'no-use-before-define': ['warn', { functions: false, classes: true, variables: true }],
      'no-unused-vars': [
        'error',
        {
          // Nepoužitý argument před používaným se vynechat nedá, proto výjimka.
          args: 'after-used',
          argsIgnorePattern: '^_',
          // Zbytek destrukturalizace je běžný způsob, jak klíč odebrat:
          // `const { base_revision, ...rest } = payload`
          ignoreRestSiblings: true,
        },
      ],
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'error',
      // Chybějící závislost efektu bývá skutečná chyba, ale u téhle codebase
      // by to teď byl hluk - proto varování, ne chyba.
      'react-hooks/exhaustive-deps': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['scripts/**/*.mjs', 'vite/**/*.js'],
    languageOptions: { globals: globals.node },
  },
];
