import cookieParser from "cookie-parser";
import express, { Application } from "express";

import { API_PREFIX } from "./constants";
import { errorHandler, generalLimiter, notFoundHandler } from "./middleware";
import authRouter from "./modules/auth/auth.routes";
import inventoryRouter from "./modules/inventory/inventory.routes";
import tasksRouter from "./modules/tasks/tasks.routes";
import usersRouter from "./modules/users/users.routes";

const app: Application = express();

app.disable("x-powered-by");

app.use(generalLimiter);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/users`, usersRouter);
app.use(`${API_PREFIX}/inventory`, inventoryRouter);
app.use(`${API_PREFIX}/tasks`, tasksRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
