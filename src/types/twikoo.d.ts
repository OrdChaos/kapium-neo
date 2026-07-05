declare module 'twikoo' {
  interface TwikooInitOptions {
    envId: string;
    el: string | HTMLElement;
    path?: string;
    lang?: string;
    region?: string;
  }

  interface Twikoo {
    init(options: TwikooInitOptions): void;
  }

  const twikoo: Twikoo;
  export default twikoo;
}
