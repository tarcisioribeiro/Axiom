import type { Decorator, Preview } from '@storybook/react';
import React from 'react';

import '../src/i18n';
import '../src/index.css';

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string | undefined) ?? 'light';

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <Story />
    </div>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Alucard (Light)' },
          { value: 'dark', icon: 'moon', title: 'Dracula (Dark)' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
  },
  decorators: [withTheme],
};

export default preview;
