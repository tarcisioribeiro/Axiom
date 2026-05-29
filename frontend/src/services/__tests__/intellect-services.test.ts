import { describe, it, expect, vi, beforeEach } from 'vitest';

import { apiClient } from '@/services/api-client';
import {
  coursesService,
  courseModulesService,
  courseSessionsService,
} from '@/services/courses-service';
import { skillsService } from '@/services/skills-service';
import type {
  Course,
  CourseFormData,
  CourseLesson,
  CourseModule,
  CourseModuleFormData,
  CourseSession,
  CourseSessionFormData,
  Skill,
  SkillFormData,
} from '@/types';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockCourse: Course = {
  id: 1,
  uuid: 'test-uuid-1',
  title: 'React Fundamentals',
  platform: 'udemy',
  platform_display: 'Udemy',
  category: 'technology',
  category_display: 'Technology',
  description: null,
  url: 'https://example.com',
  estimated_hours: 20,
  status: 'in_progress',
  status_display: 'In Progress',
  start_date: '2025-01-01',
  end_date: null,
  total_lessons: 10,
  completed_lessons: 4,
  progress_percentage: 40,
  invested_hours: 8,
  owner: 1,
  owner_name: 'Test User',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockSkill: Skill = {
  id: 1,
  uuid: 'skill-uuid-1',
  name: 'Python',
  category: 'technology',
  category_display: 'Technology',
  proficiency: 'intermediate',
  proficiency_display: 'Intermediate',
  proficiency_level: 3,
  status: 'evolving',
  status_display: 'Evolving',
  notes: null,
  owner: 1,
  owner_name: 'Test User',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('CoursesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists courses via getAll', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      results: [mockCourse],
      count: 1,
      next: null,
      previous: null,
    });

    const result = await coursesService.getAll();

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/library/courses/', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('React Fundamentals');
  });

  it('creates a course via create', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockCourse);

    const data: CourseFormData = {
      title: 'React Fundamentals',
      platform: 'udemy',
      category: 'technology',
      status: 'not_started',
      owner: 1,
    };
    const result = await coursesService.create(data);

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/library/courses/', data);
    expect(result.id).toBe(1);
  });

  it('toggles a lesson via toggleLesson', async () => {
    const mockLesson: CourseLesson = {
      id: 5,
      uuid: 'lesson-uuid',
      module: 1,
      module_title: 'Module 1',
      title: 'Intro',
      order: 1,
      is_completed: true,
      completed_at: '2025-01-01T12:00:00Z',
      owner: 1,
      owner_name: 'Test User',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    vi.mocked(apiClient.patch).mockResolvedValueOnce(mockLesson);

    const result = await coursesService.toggleLesson(5);

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/library/course-lessons/5/toggle/',
      {}
    );
    expect(result.is_completed).toBe(true);
  });

  it('deletes a course via delete', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

    await coursesService.delete(1);

    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/library/courses/1/');
  });
});

describe('CourseModulesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a module with correct endpoint', async () => {
    const mockModule: CourseModule = {
      id: 1,
      uuid: 'mod-uuid',
      course: 1,
      title: 'Module 1',
      order: 1,
      total_lessons: 0,
      completed_lessons: 0,
      owner: 1,
      owner_name: 'Test User',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockModule);

    const data: CourseModuleFormData = {
      course: 1,
      title: 'Module 1',
      order: 1,
      owner: 1,
    };
    const result = await courseModulesService.create(data);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/library/course-modules/',
      data
    );
    expect(result.title).toBe('Module 1');
  });
});

describe('CourseSessionsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a session with correct endpoint', async () => {
    const mockSession: CourseSession = {
      id: 1,
      uuid: 'sess-uuid',
      course: 1,
      course_title: 'React Fundamentals',
      session_date: '2025-05-20',
      duration_minutes: 90,
      duration_hours: 1.5,
      notes: null,
      owner: 1,
      owner_name: 'Test User',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockSession);

    const data: CourseSessionFormData = {
      course: 1,
      session_date: '2025-05-20',
      duration_minutes: 90,
      notes: null,
      owner: 1,
    };
    const result = await courseSessionsService.create(data);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/library/course-sessions/',
      data
    );
    expect(result.duration_hours).toBe(1.5);
  });
});

describe('SkillsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists skills via getAll', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      results: [mockSkill],
      count: 1,
      next: null,
      previous: null,
    });

    const result = await skillsService.getAll();

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/library/skills/', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].proficiency_level).toBe(3);
  });

  it('creates a skill via create', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockSkill);

    const data: SkillFormData = {
      name: 'Python',
      category: 'technology',
      proficiency: 'intermediate',
      status: 'evolving',
      notes: null,
      owner: 1,
    };
    const result = await skillsService.create(data);

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/library/skills/', data);
    expect(result.name).toBe('Python');
  });

  it('updates a skill via update', async () => {
    const updated = {
      ...mockSkill,
      proficiency: 'advanced' as const,
      proficiency_level: 4,
    };
    vi.mocked(apiClient.put).mockResolvedValueOnce(updated);

    const data: SkillFormData = {
      name: 'Python',
      category: 'technology',
      proficiency: 'advanced',
      status: 'evolving',
      notes: null,
      owner: 1,
    };
    const result = await skillsService.update(1, data);

    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/library/skills/1/', data);
    expect(result.proficiency_level).toBe(4);
  });

  it('deletes a skill via delete', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

    await skillsService.delete(1);

    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/library/skills/1/');
  });
});
