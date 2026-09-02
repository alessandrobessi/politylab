// PolityLab is a pure client-side app: the simulation engine runs in the
// browser (later in a Web Worker) and there is no backend. Prerender the shell
// and disable SSR so the static adapter emits a single-page app.
export const prerender = true;
export const ssr = false;
