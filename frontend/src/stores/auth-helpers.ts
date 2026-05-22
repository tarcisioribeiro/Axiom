import { logger } from '@/lib/logger';
import { membersService } from '@/services/members-service';
import type { User } from '@/types';

export async function enrichUserWithMemberData(
  user: User,
  logPrefix = '[AuthStore]'
): Promise<User> {
  try {
    const memberData = await membersService.getCurrentUserMember();
    if (memberData?.name) {
      const nameParts = memberData.name.trim().split(' ');
      return {
        ...user,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        profile_photo: memberData.profile_photo ?? null,
      };
    }
  } catch (error) {
    logger.log(`${logPrefix} Could not fetch member data:`, error);
  }
  return user;
}
