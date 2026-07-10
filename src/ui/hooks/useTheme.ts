import { useDarkMode } from '../contexts/DarkModeContext';

export const useTheme = () => {
  const { isDarkMode } = useDarkMode();

  const theme = {
    // Background classes
    bg: {
      primary: 'bg-theme-primary',
      secondary: 'bg-theme-secondary',
      tertiary: 'bg-theme-tertiary',
      card: 'bg-theme-card',
      input: 'bg-theme-input',
      hover: 'bg-theme-hover',
      sidebar: 'bg-theme-sidebar',
    },
    // Text classes
    text: {
      primary: 'text-theme-primary',
      secondary: 'text-theme-secondary',
      muted: 'text-theme-muted',
      inverse: 'text-theme-inverse',
    },
    // Border classes
    border: {
      primary: 'border-theme-primary',
      secondary: 'border-theme-secondary',
      accent: 'border-theme-accent',
    },
    // Shadow classes
    shadow: {
      sm: 'shadow-theme-sm',
      md: 'shadow-theme-md',
      lg: 'shadow-theme-lg',
    },
    // Common component styles
    components: {
      card: 'bg-theme-card border border-theme-primary shadow-theme-sm',
      input: 'bg-theme-input border border-theme-primary text-theme-primary placeholder:text-theme-muted',
      button: {
        primary: 'bg-brand-primary hover:bg-brand-secondary text-white',
        secondary: 'bg-theme-secondary hover:bg-theme-tertiary text-theme-primary border border-theme-primary',
        outline: 'border border-theme-primary text-theme-primary hover:bg-theme-hover',
      },
      table: {
        header: 'bg-theme-secondary text-theme-primary',
        row: 'border-b border-theme-primary hover:bg-theme-hover',
        cell: 'text-theme-primary',
      },
    },
  };

  return {
    isDarkMode,
    theme,
    // Helper function to conditionally apply classes
    classNames: (...classes: (string | undefined | null | false)[]) => 
      classes.filter(Boolean).join(' '),
  };
};
