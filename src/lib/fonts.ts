import {
  Open_Sans,
  Roboto_Condensed,
  Zilla_Slab_Highlight,
} from "next/font/google";

const openSans = Open_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin-ext"],
  variable: "--font-regular",
});

const robotoCondensed = Roboto_Condensed({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-secondary",
});

const zilla = Zilla_Slab_Highlight({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-logo",
});

export {
  openSans as regularFont,
  robotoCondensed as secondaryFont,
  zilla as logoFont,
};
