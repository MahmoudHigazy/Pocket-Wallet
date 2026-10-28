module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Lets drizzle's migrations.js import the generated .sql files.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
