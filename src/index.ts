import { Elysia } from "elysia";
import { empireRoutes } from "./routes/empire";
import { galaxyRoutes } from "./routes/galaxy";
import { eventsRoutes } from "./routes/events";
import "./db";

const app = new Elysia()
    .use(eventsRoutes)
    .use(empireRoutes)
    .use(galaxyRoutes)
    .listen(8080)

console.log(`openspore-server running on http://localhost:${app.server?.port}`);