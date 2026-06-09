type LogLevel = "error" | "warn" | "info";

export const getLogLevel = (statusCode: number): LogLevel => {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";

  return "info";
};
