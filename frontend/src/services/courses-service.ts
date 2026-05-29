import { API_CONFIG } from '@/config/constants';
import type {
  Course,
  CourseFormData,
  CourseLesson,
  CourseLessonFormData,
  CourseModule,
  CourseModuleFormData,
  CourseSession,
  CourseSessionFormData,
} from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class CoursesService extends BaseService<Course, CourseFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.COURSES);
  }

  async toggleLesson(id: number): Promise<CourseLesson> {
    return apiClient.patch<CourseLesson>(
      `${API_CONFIG.ENDPOINTS.COURSE_LESSONS}${id}/toggle/`,
      {}
    );
  }
}

class CourseModulesService extends BaseService<CourseModule, CourseModuleFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.COURSE_MODULES);
  }
}

class CourseLessonsService extends BaseService<CourseLesson, CourseLessonFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.COURSE_LESSONS);
  }
}

class CourseSessionsService extends BaseService<CourseSession, CourseSessionFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.COURSE_SESSIONS);
  }
}

export const coursesService = new CoursesService();
export const courseModulesService = new CourseModulesService();
export const courseLessonsService = new CourseLessonsService();
export const courseSessionsService = new CourseSessionsService();
