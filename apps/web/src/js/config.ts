const target = import.meta.env.MODE.startsWith('extension') ? 'extension' : 'webapp'
const mode = import.meta.env.DEV || import.meta.env.MODE === 'extension-development' ? 'development' : 'production'
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8002'
const publicServiceUrl = import.meta.env.VITE_PUBLIC_SERVICE_URL || backendUrl

const config = {
  target,
  mode,
  apiBaseUrl: target === 'extension' ? backendUrl : '',
  serviceUrl: publicServiceUrl,
  displayServiceUrl: import.meta.env.VITE_DISPLAY_SERVICE_URL || 'shlk.cc',
  extensionLink: import.meta.env.VITE_EXTENSION_STORE_URL || ''
} as const

export default config

