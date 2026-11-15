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
    background_color: "#f1f5f9",
    theme_color: "#1d4ed8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
