
import { pwnedPassword } from 'hibp';

export const checkPasswordBreach = async (password: string): Promise<{ isBreached: boolean; message: string }> => {
  try {
    const breachCount = await pwnedPassword(password);
    if (breachCount > 0) {
      return {
        isBreached: true,
        message: `This password has appeared in ${breachCount.toLocaleString()} past data breaches. Please choose a stronger one.`
      };
    }
    return { isBreached: false, message: '' };
  } catch (error) {
    console.error('Error checking password breach:', error);
    // If the service is unavailable, allow signup to continue
    return { isBreached: false, message: '' };
  }
};
