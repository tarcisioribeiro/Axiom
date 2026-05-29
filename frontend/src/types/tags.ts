export interface Tag {
  id: number;
  uuid: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface TagFormData {
  name: string;
  color: string;
}
