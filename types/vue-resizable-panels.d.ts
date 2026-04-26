/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'vue-resizable-panels' {
  import type { DefineComponent } from 'vue'

  export const PanelGroup: DefineComponent<any, any, any>
  export const Panel: DefineComponent<any, any, any>
  export const PanelResizeHandle: DefineComponent<any, any, any>
}
