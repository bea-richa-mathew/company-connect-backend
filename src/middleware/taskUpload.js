
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const taskUploadDirectory = path.resolve(
  process.cwd(),
  "uploads",
  "task-attachments"
);

fs.mkdirSync(taskUploadDirectory, {
  recursive: true
});

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, taskUploadDirectory);
  },
  filename: (_req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    callback(
      null,
      `${crypto.randomUUID()}${extension}`
    );
  }
});

const allowedTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

export const uploadTaskAttachment = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(
        new Error("Unsupported attachment type")
      );
    }

    callback(null, true);
  }
}).single("file");
