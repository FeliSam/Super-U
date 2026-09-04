module.exports = function (api) {
  api.cache(true);
  return {
    // CourseGO n'importe plus reanimated/worklets ; le plugin Babel
    // auto-injecté casse Metro (@babel/generator introuvable en monorepo).
    presets: [['babel-preset-expo', { reanimated: false, worklets: false }]],
  };
};
