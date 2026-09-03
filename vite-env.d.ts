/// <reference types="vite/client" />

// Vite resolves `?url` imports to the emitted asset path at build time.
declare module '*?url' {
  const src: string;
  export default src;
}
