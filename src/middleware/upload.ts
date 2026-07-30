import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import { BadRequestError } from "../errors";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
}).single("avatar");

export const uploadAvatarMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(new BadRequestError("File too large — maximum size is 5 MB"));
    }

    return next(new BadRequestError(err.message));
  });
};
