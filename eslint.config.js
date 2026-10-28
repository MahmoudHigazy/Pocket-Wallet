const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['dist/*', 'functions/lib/*'] },
  {
    // src/domain must stay pure: no React / Expo / React Native imports.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-native', 'react-native/*', 'expo', 'expo-*', 'expo/*'] },
      ],
    },
  },
]);
