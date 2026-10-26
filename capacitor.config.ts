import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: "io.ionic.demo.pg.cap.ng",
  appName: "Photo Gallery Cap Ng",
  npmClient: "npm",
  webDir: "www",
  server: {
    // Por defecto Capacitor sirve la app nativa como "https://localhost",
    // lo que hace que el WebView bloque por "Mixed Content" cualquier
    // llamada a la API en http:// plano (login.php, register.php,
    // catalog/*.php corren en Apache sin HTTPS). Sirviendo la app por
    // http:// tambien, ambos quedan en el mismo esquema y deja de bloquearse.
    androidScheme: "http",
  },
};

export default config;
