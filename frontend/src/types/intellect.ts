export type CourseStatus = 'not_started' | 'in_progress' | 'completed' | 'paused';
export type CoursePlatform =
  | 'udemy'
  | 'coursera'
  | 'youtube'
  | 'linkedin'
  | 'alura'
  | 'pluralsight'
  | 'other';
export type IntellectCategory =
  | 'technology'
  | 'languages'
  | 'design'
  | 'business'
  | 'science'
  | 'arts'
  | 'other';
export type SkillProficiency =
  | 'beginner'
  | 'basic'
  | 'intermediate'
  | 'advanced'
  | 'expert';
export type SkillStatus = 'learning' | 'evolving' | 'mastered';

export interface Course {
  id: number;
  uuid: string;
  title: string;
  platform: CoursePlatform;
  platform_display: string;
  category: IntellectCategory;
  category_display: string;
  description?: string | null;
  url?: string | null;
  estimated_hours?: number | null;
  status: CourseStatus;
  status_display: string;
  start_date?: string | null;
  end_date?: string | null;
  completion_certificate?: string | null;
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
  invested_hours: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface CourseFormData {
  title: string;
  platform: CoursePlatform;
  category: IntellectCategory;
  description?: string | null;
  url?: string | null;
  estimated_hours?: number | null;
  status: CourseStatus;
  start_date?: string | null;
  end_date?: string | null;
  owner: number;
}

export interface CourseModule {
  id: number;
  uuid: string;
  course: number;
  course_title?: string;
  title: string;
  order: number;
  lessons?: CourseLesson[];
  total_lessons: number;
  completed_lessons: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface CourseModuleFormData {
  course: number;
  title: string;
  order: number;
  owner: number;
}

export interface CourseLesson {
  id: number;
  uuid: string;
  module: number;
  module_title: string;
  title: string;
  order: number;
  is_completed: boolean;
  completed_at?: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface CourseLessonFormData {
  module: number;
  title: string;
  order: number;
  owner: number;
}

export interface CourseSession {
  id: number;
  uuid: string;
  course: number;
  course_title: string;
  session_date: string;
  duration_minutes: number;
  duration_hours: number;
  notes?: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface CourseSessionFormData {
  course: number;
  session_date: string;
  duration_minutes: number;
  notes?: string | null;
  owner: number;
}

export interface Skill {
  id: number;
  uuid: string;
  name: string;
  category: IntellectCategory;
  category_display: string;
  proficiency: SkillProficiency;
  proficiency_display: string;
  proficiency_level: number;
  status: SkillStatus;
  status_display: string;
  notes?: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface SkillFormData {
  name: string;
  category: IntellectCategory;
  proficiency: SkillProficiency;
  status: SkillStatus;
  notes?: string | null;
  owner: number;
}

// ============================================================================
// KNOWLEDGE GRAPH TYPES
// ============================================================================

export type KnowledgeNodeType =
  | 'book'
  | 'course'
  | 'skill'
  | 'highlight'
  | 'summary'
  | 'author';

export type KnowledgeLinkRelation =
  | 'relates'
  | 'supports'
  | 'contradicts'
  | 'deepens'
  | 'derived_from'
  | 'applies';

export interface KnowledgeLink {
  id: number;
  uuid: string;
  source_type: KnowledgeNodeType;
  source_type_display: string;
  source_id: string;
  target_type: KnowledgeNodeType;
  target_type_display: string;
  target_id: string;
  relation_label: KnowledgeLinkRelation;
  relation_label_display: string;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeLinkFormData {
  source_type: KnowledgeNodeType;
  source_id: string;
  target_type: KnowledgeNodeType;
  target_id: string;
  relation_label: KnowledgeLinkRelation;
  owner: number;
}

export interface GraphNodeMetadata {
  // Book
  genre?: string;
  read_status?: string;
  pages?: number;
  rating?: number | null;
  // Author
  nationality_display?: string;
  // Summary
  book_title?: string | null;
  // Highlight
  highlight_type?: string;
  color?: string;
  page_number?: number | null;
  // Course
  platform?: string;
  category?: string;
  status?: string;
  progress_percentage?: number;
  // Skill
  proficiency?: string;
}

export interface GraphNode {
  id: string;
  type: KnowledgeNodeType;
  label: string;
  metadata: GraphNodeMetadata;
  // runtime fields populated by force-graph
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  [others: string]: unknown;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'implicit' | 'explicit';
  relation: string;
  relation_display?: string;
  link_id?: number;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
