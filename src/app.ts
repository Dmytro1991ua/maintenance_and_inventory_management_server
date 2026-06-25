// openapi config MUST be imported first — extendZodWithOpenApi() must run
// before any schema file (which calls .openapi()) is imported below.
// Side-effect imports — register each module's paths with the OpenAPI registry.
// Must run after openapi config (above) and before generateOpenApiDocument().
import "./modules/auth/auth.openapi";
import "./modules/inventory/inventory.openapi";
import "./modules/notifications/notifications.openapi";
import "./modules/tasks/tasks.openapi";
import "./modules/users/users.openapi";

import cookieParser from "cookie-parser";
import express, { Application } from "express";
import swaggerUi from "swagger-ui-express";

import { env } from "./config";
import { generateOpenApiDocument } from "./config/openapi";
import { API_PREFIX } from "./constants";
import {
  corsMiddleware,
  errorHandler,
  generalLimiter,
  helmetMiddleware,
  jsonSizeLimit,
  notFoundHandler,
  requestLogger,
  urlencodedSizeLimit,
} from "./middleware";
import authRouter from "./modules/auth/auth.routes";
import inventoryRouter from "./modules/inventory/inventory.routes";
import notificationsRouter from "./modules/notifications/notifications.routes";
import tasksRouter from "./modules/tasks/tasks.routes";
import usersRouter from "./modules/users/users.routes";

const app: Application = express();

app.disable("x-powered-by");

// Trust Railway's proxy (prod only) so req.ip is the real client, not the
// proxy — otherwise express-rate-limit buckets every client together.
if (env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(helmetMiddleware);
app.use(corsMiddleware);

app.use(requestLogger);
app.use(generalLimiter);
app.use(jsonSizeLimit);
app.use(urlencodedSizeLimit);
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

const openApiDocument = generateOpenApiDocument();

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get("/docs.json", (_req, res) => res.json(openApiDocument));

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/users`, usersRouter);
app.use(`${API_PREFIX}/inventory`, inventoryRouter);
app.use(`${API_PREFIX}/tasks`, tasksRouter);
app.use(`${API_PREFIX}/notifications`, notificationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
