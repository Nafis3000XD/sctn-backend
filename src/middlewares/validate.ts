import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Centralized request-body validation. Parses req.body against a zod schema;
// on failure responds 400 with a readable message, otherwise replaces req.body
// with the parsed (trimmed/normalized/typed) data so controllers receive clean,
// trusted input instead of doing ad-hoc `if (!x)` checks.
export const validateBody = (schema: z.ZodType) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => {
          const path = issue.path.join('.');
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join('; ');
      res.status(400).json({ message });
      return;
    }
    req.body = result.data;
    next();
  };
