module.exports = function (api) {
  api.cache(true);
  return {
    // Désactiver l’auto-inject du preset, puis brancher le plugin worklets EN DERNIER
    // (requis Reanimated 4 — sinon __initData manque → crash NativeWorklets).
    presets: [['babel-preset-expo', { reanimated: false, worklets: false }]],
    plugins: ['react-native-worklets/plugin'],
  };
};
