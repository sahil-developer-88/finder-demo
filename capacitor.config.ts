
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.addc932b946a4ab0b13c35106af56a35',
  appName: 'swap-shop-finder',
  webDir: 'dist',
  server: {
    url: 'https://addc932b-946a-4ab0-b13c-35106af56a35.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: ['camera']
    }
  }
};

export default config;
