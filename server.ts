import { createServer } from "node:http";
import next from "next";
import { setupSocket } from "./src/server/io";

// Charge .env tôt (le serveur custom n'a pas le chargement auto de `next dev`).
try {
  process.loadEnvFile(".env");
} catch {
  // .env absent : on s'appuie sur l'environnement déjà présent.
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  setupSocket(httpServer);

  httpServer.listen(port, () => {
    console.log(`\n  ▲ AQOJ prêt — http://${hostname}:${port}\n`);
  });
});
