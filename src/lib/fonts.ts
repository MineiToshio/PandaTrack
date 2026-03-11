import localFont from "next/font/local";

const openSans = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/open-sans/files/open-sans-latin-ext-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/open-sans/files/open-sans-latin-ext-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/open-sans/files/open-sans-latin-ext-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/open-sans/files/open-sans-latin-ext-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-regular",
});

const robotoCondensed = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-secondary",
});

const zilla = localFont({
  src: "../../node_modules/@fontsource/zilla-slab-highlight/files/zilla-slab-highlight-latin-700-normal.woff2",
  variable: "--font-logo",
});

export { openSans as regularFont, robotoCondensed as secondaryFont, zilla as logoFont };
