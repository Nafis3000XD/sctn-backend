import prisma from '../db';

export const generateCitizenId = async (): Promise<string> => {
  while (true) {
    const citizenId = `SCTN-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await prisma.citizenProfile.findUnique({ where: { citizenId } });
    if (!existing) return citizenId;
  }
};
