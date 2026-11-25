import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.walidelsayedgemini.thelastthread',
  appName: 'الخيط الأخير',
  webDir: 'dist',
  backgroundColor: '#0a0807',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
  },
}

export default config
