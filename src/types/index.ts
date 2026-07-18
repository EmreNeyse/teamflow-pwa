export type TaskStatus = 'todo' | 'inprogress' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';
export type RoutineType = 'monday_plan' | 'wednesday_checkin' | 'friday_report';

export interface UserProfile {
  id: string;
  name: string;
  surname: string;
  email: string;
  pin: string;
  avatarIdx: number;
}

export interface UserSummary {
  id: string;
  name: string;
  surname: string;
  email: string;
  avatarIdx: number;
}

export interface AppConfig {
  groq?: string;
  cloud?: CloudSyncConfig;
}

export interface CloudSyncConfig {
  enabled: boolean;
  email: string;
  localUpdatedAt?: string;
  lastSyncedAt?: string;
  lastPushedAt?: string;
  lastPulledAt?: string;
}

export interface TaskNote {
  text: string;
  at: string;
}

export interface Task {
  id: string;
  title: string;
  desc: string;
  prio: TaskPriority;
  status: TaskStatus;
  due: string;
  tag: string;
  wk: string;
  created: string;
  notes: TaskNote[];
}

export interface Report {
  id: string;
  wk: string;
  created: string;
  total: number;
  done: number;
  inprogress: number;
  todo: number;
  overdue: number;
  summary: string;
}

export interface AppNotification {
  id: string;
  type: RoutineType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  weekKey: string;
}

export interface RoutineFlags {
  mondayWeek?: string;
  wednesdayWeek?: string;
  fridayWeek?: string;
}

export interface UserData {
  profile: UserProfile;
  cfg: AppConfig;
  tasks: Task[];
  reports: Report[];
  notifications: AppNotification[];
  routineFlags: RoutineFlags;
  wkOff: number;
  filter: 'all' | TaskPriority;
  darkMode?: boolean;
  ready: boolean;
}

export interface UserRegistry {
  users: UserSummary[];
  lastUserId?: string;
}

export interface SessionState {
  userId: string;
}

export interface LegacyState {
  profile: Omit<UserProfile, 'id'> | null;
  cfg: AppConfig;
  tasks: Task[];
  reports: Report[];
  wkOff: number;
  filter: 'all' | TaskPriority;
  darkMode?: boolean;
  ready: boolean;
}
