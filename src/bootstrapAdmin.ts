import 'dotenv/config';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import prisma from './db';

async function bootstrapAdmin() {
  if (await prisma.user.findFirst({ where: { role: 'Admin', isActive: true }, select: { id: true } })) {
    console.log('An active administrator already exists.');
    return;
  }

  const email = z.email().parse(process.env.ADMIN_EMAIL?.trim().toLowerCase());
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must have at least 12 characters and at most 72 UTF-8 bytes.');
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role: 'Admin', passwordHash: await bcrypt.hash(password, 12) },
    select: { role: true, isActive: true }
  });

  if (user.role !== 'Admin' || !user.isActive) {
    throw new Error('ADMIN_EMAIL already belongs to an existing account that cannot be bootstrapped.');
  }
  console.log('Administrator account is ready.');
}

bootstrapAdmin()
  .catch((error: unknown) => {
    console.error('Administrator setup failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
