import express, { Application } from "express";
import { errorHandler, notFoundHandler } from "./middleware";

const app: Application = express();

app.disable("x-powered-by");

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
