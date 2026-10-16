import { API_CONFIG } from '@/config/constants';
import type { Skill, SkillFormData } from '@/types';

import { BaseService } from './base-service';

class SkillsService extends BaseService<Skill, SkillFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.SKILLS);
  }
}

export const skillsService = new SkillsService();
