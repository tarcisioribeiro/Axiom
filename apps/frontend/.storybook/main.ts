import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.{ts,tsx}'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(viteConfig) {
    // The root vite.config.ts registers vite-plugin-pwa for the app build.
    // Storybook's static output isn't the app (no manifest/offline use case),
    // and workbox tries to precache Storybook's own manager bundle, which
    // exceeds the default 2 MiB precache limit and fails the build.
    return {
      ...viteConfig,
      // vite-plugin-pwa returns an array of sub-plugins, so flatten before
      // filtering — otherwise the outer array (not a real plugin) slips
      // through the name check untouched.
      plugins: viteConfig.plugins
        ?.flat(Infinity)
        .filter(
          (plugin) =>
            !(
              plugin &&
              typeof plugin === 'object' &&
              'name' in plugin &&
              String(plugin.name).startsWith('vite-plugin-pwa')
            )
        ),
    };
  },
};

export default config;
