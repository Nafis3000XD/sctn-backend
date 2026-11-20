import multer from 'multer';
import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';

interface UploadOptions {
  allowedMimeTypes: string[];
  maxFileSizeBytes: number;
  maxFiles: number;
  fileTypeError: string;
}

const signatures: Record<string, (bytes: Buffer) => boolean> = {
  'application/pdf': (bytes) => bytes.subarray(0, 5).toString() === '%PDF-',
  'image/jpeg': (bytes) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  'image/png': (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/webp': (bytes) => bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
};

export function createUpload(options: UploadOptions) {
  const allowed = new Set(options.allowedMimeTypes);
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: options.maxFileSizeBytes,
      files: options.maxFiles,
      fields: 16,
      fieldSize: 16 * 1024
    },
    fileFilter: (_req, file, done) => {
      if (!allowed.has(file.mimetype)) {
        done(Object.assign(new Error(options.fileTypeError), { status: 415 }));
        return;
      }
      done(null, true);
    }
  });
}

export function validateUploads(handler: RequestHandler, fieldTypes: Record<string, string[]> = {}): RequestHandler {
  return (req, res, next) => {
    handler(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      const grouped = Object.values(req.files ?? {}).flat();
      const files = req.file ? [req.file] : grouped;

      const invalid = files.some((file) =>
        !signatures[file.mimetype]?.(file.buffer)
        || (fieldTypes[file.fieldname] && !fieldTypes[file.fieldname].includes(file.mimetype))
      );
      if (invalid) {
        res.status(415).json({ message: 'File contents do not match the expected file type' });
        return;
      }
      next();
    });
  };
}

export async function saveUpload(
  tx: Prisma.TransactionClient,
  file: Express.Multer.File,
  ownerId: string,
  category: 'Profile' | 'Document' | 'Prescription'
) {
  const upload = await tx.uploadedFile.create({
    data: { bytes: file.buffer, mimeType: file.mimetype, ownerId, category },
    select: { id: true }
  });
  return `/uploads/${upload.id}`;
}

export async function removeUploads(tx: Prisma.TransactionClient, urls: (string | null)[]) {
  const ids = urls.flatMap((url) => url?.startsWith('/uploads/') ? [url.slice(9)] : []);
  if (ids.length > 0) await tx.uploadedFile.deleteMany({ where: { id: { in: ids } } });
}
