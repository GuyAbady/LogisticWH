import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LogisticWH – ניהול ציוד מרלו\"ג",
    short_name: "LogisticWH",
    description: "ניהול מלאי, מצאי והחתמות ציוד דיגיטליות",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
