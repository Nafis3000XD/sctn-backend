import type { Request, Response } from 'express';

const cookieName = 'sctn_media';
export const sessionLifetimeSeconds = 24 * 60 * 60;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/uploads'
};

export function setMediaSession(res: Response, token: string) {
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionLifetimeSeconds * 1000 });
}

export function clearMediaSession(res: Response) {
  res.clearCookie(cookieName, cookieOptions);
}

export function getMediaSession(req: Request) {
  return req.headers.cookie?.split(';').map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}
