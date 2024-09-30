import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary colors
        sunflowerYellow: {
          light: '#FCE2A6',  // Lighter shade for backgrounds or highlights
          DEFAULT: '#F7C15B', // Base yellow-orange for main elements
          dark: '#E5A643',    // Darker shade for emphasis and accents
        },
        beige: {
          light: '#FBF6EF',  // Light beige for backgrounds
          DEFAULT: '#F6EDE2', // Neutral base for sections
          dark: '#D9CBB8',    // Darker beige for borders or text
        },

        // Secondary and accent colors
        sunflowerDark: {
          light: '#E6B773',  // Lighter sunflower for softer accents
          DEFAULT: '#C7933D', // Base dark sunflower for primary accents
          dark: '#8F6526',    // Darker sunflower for stronger emphasis
        },
        charcoal: {
          light: '#666666',   // Mid-grey for secondary text or icons
          DEFAULT: '#333333', // Dark grey for primary text or outlines
          dark: '#1A1A1A',    // Near-black for strong contrast or emphasis
        },

        // Neutrals
        white: '#FFFFFF',      // Pure white for text and high contrast elements

        // Tertiary Colors
        pastelPink: '#F8D7DA', // Soft pink for light accents or alerts
        mintGreen: '#D8F3DC',  // Light green for success messages or highlights
        skyBlue: '#BEE3F8',    // Light blue for info messages or secondary accents
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
