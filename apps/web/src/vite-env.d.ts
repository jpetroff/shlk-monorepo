/// <reference types="vite/client" />

declare module '*.svg?react' {
  import type { FunctionComponent, SVGProps } from 'react'
  const Component: FunctionComponent<SVGProps<SVGSVGElement>>
  export default Component
}

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string
  readonly VITE_PUBLIC_SERVICE_URL?: string
  readonly VITE_DISPLAY_SERVICE_URL?: string
  readonly VITE_EXTENSION_STORE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const Modernizr: {
  touchevents: boolean
  mq(query: string): boolean
}
