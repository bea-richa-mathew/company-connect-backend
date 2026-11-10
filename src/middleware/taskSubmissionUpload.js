import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

export const uploadDir = path.resolve(
  "uploads/task-submissions"
);

fs.mkdirSync(uploadDir, { recursive: true });

const extensions = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
  ".docx",
  ".xlsx",
]);

const mimeTypes = {
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".txt": ["text/plain"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },

  filename: (_req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    callback(
      null,
      `${randomUUID()}${extension}`
    );
  },
});

export const taskSubmissionUpload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (
      !extensions.has(extension) ||
      !mimeTypes[extension]?.includes(file.mimetype)
    ) {
      return callback(
        new Error("Unsupported file type")
      );
    }

    callback(null, true);
  },
}).single("file");