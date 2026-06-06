import cookieParser from "cookie-parser";
import express, { Application } from "express";

import { API_PREFIX } from "./constants";
import { errorHandler, notFoundHandler } from "./middleware";
import authRouter from "./modules/auth/auth.routes";

const app: Application = express();

app.disable("x-powered-by");

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use(`${API_PREFIX}/auth`, authRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
