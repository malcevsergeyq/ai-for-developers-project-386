import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['.opencode/**', 'ui/dist/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Аргумент с префиксом _ — осознанно неиспользуемый: обработчик ошибок Express
      // обязан принимать (err, req, res, next), иначе Express не распознаёт его как error middleware.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    // Точка входа печатает сообщение о старте — это её работа, а не забытая отладка.
    files: ['server/index.js'],
    rules: { 'no-console': 'off' },
  },
];
