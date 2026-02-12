import multer from "multer";
import { Request, Response, NextFunction } from "express";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024, // 200KB
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(
        new Error(
          "Only PDF, JPG, JPEG, and PNG files are allowed"
        )
      );
    } else {
      cb(null, true);
    }
  },
});

export const uploadAttachment = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  upload.single("attachment")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new Error("File exceeds 200KB limit"));
      }
    }

    return next(err);
  });
};

export const uploadAgentAttachment = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const agentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
      const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
      if (!allowed.includes(file.mimetype)) {
        cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed"));
      } else {
        cb(null, true);
      }
    },
  });
  agentUpload.single("attachment")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new Error("File exceeds 2MB limit"));
      }
    }
    return next(err);
  });
};
