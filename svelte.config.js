import { vitePreprocess } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";

export default {
  kit: {
    adapter: adapter({
      // default options are shown. On some platforms
      // these options are set automatically — see below
      pages: "dist/",
      assets: "dist/",
      fallback: undefined,
      precompress: false,
      strict: true,
    }),
    paths: {
      base: process.env.BASE_PATH || '',
      relative: true,
    },
  },

  preprocess: [vitePreprocess({})],
};
