import { Elysia } from "elysia";
import { empireRoutes } from "./routes/empire";
import { galaxyRoutes } from "./routes/galaxy";
import { eventsRoutes } from "./routes/events";
import { diplomacyRoutes } from "./routes/diplomacy";
import { relayRoutes } from "./routes/relay";
import "./db";

const app = new Elysia()
    .use(eventsRoutes)
    .use(empireRoutes)
    .use(galaxyRoutes)
    .use(diplomacyRoutes)
    .use(relayRoutes)
    .listen(Number(process.env.PORT ?? 8080))

console.log(`openspore-server running on http://localhost:${app.server?.port}`);