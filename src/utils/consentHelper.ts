import prisma from '../db';

export const checkAndExpireRequests = async (): Promise<void> => {
  try {
    const now = new Date();
    await prisma.consentRequest.updateMany({
      where: {
        status: 'Approved',
        expiryTime: {
          lt: now
        }
      },
      data: {
        status: 'Expired'
      }
    });
  } catch (error) {
    console.error('Error auto-expiring consent requests:', error);
  }
};
