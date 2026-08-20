import type { MetadataRoute } from "next";

// Isso é o que faz o App Coletivo poder ser "instalado" na tela inicial do
// celular (Android e iPhone) como se fosse um aplicativo normal, sem passar
// pela Google Play nem pela App Store.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "App Coletivo",
    short_name: "Coletivo",
    description:
      "Organização e gestão de coletivos comunitários e suas frentes de atuação.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f2",
    theme_color: "#2e6b3e",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
