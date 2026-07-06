import { create } from 'zustand';
import api from '../api';

export interface TaskUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface TaskAssignee {
  taskId: string;
  userId: string;
  user: TaskUser;
}

export interface TaskComment {
  id: string;
  taskId: string;
  content: string;
  createdAt: string;
  author: TaskUser;
}

export interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'ON_HOLD' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  tags: string[];
  attachments: string[];
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  creator: TaskUser;
  assignees: TaskAssignee[];
  comments?: TaskComment[];
  subtasks?: TaskData[];
  parentTask?: { id: string; title: string } | null;
  _count?: { comments: number; subtasks: number };
}

interface TaskState {
  tasks: TaskData[];
  kanbanTasks: {
    NOT_STARTED: TaskData[];
    IN_PROGRESS: TaskData[];
    BLOCKED: TaskData[];
    ON_HOLD: TaskData[];
    COMPLETED: TaskData[];
  };
  calendarTasks: { id: string; title: string; dueDate: string; status: string; priority: string }[];
  teamTasks: TaskData[];
  activeTask: TaskData | null;
  isLoading: boolean;

  fetchTasks: (tab?: string, sort?: string) => Promise<void>;
  fetchTaskById: (id: string) => Promise<TaskData>;
  fetchKanbanBoard: () => Promise<void>;
  fetchCalendarTasks: () => Promise<void>;
  fetchTeamTasks: () => Promise<void>;
  createTask: (data: Omit<Partial<TaskData>, 'assignees'> & { assignees?: string[] }) => Promise<TaskData>;
  updateTask: (id: string, data: Partial<TaskData>) => Promise<TaskData>;
  deleteTask: (id: string) => Promise<void>;
  assignUser: (taskId: string, userId: string) => Promise<void>;
  unassignUser: (taskId: string, userId: string) => Promise<void>;
  addComment: (taskId: string, content: string) => Promise<TaskComment>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  kanbanTasks: {
    NOT_STARTED: [],
    IN_PROGRESS: [],
    BLOCKED: [],
    ON_HOLD: [],
    COMPLETED: []
  },
  calendarTasks: [],
  teamTasks: [],
  activeTask: null,
  isLoading: false,

  fetchTasks: async (tab = 'All', sort = 'dueDate') => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/api/tasks`, { params: { tab, sort } });
      set({ tasks: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  fetchTaskById: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/api/tasks/${id}`);
      set({ activeTask: data, isLoading: false });
      return data;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  fetchKanbanBoard: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/api/tasks/board`);
      set({ kanbanTasks: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  fetchCalendarTasks: async () => {
    try {
      const { data } = await api.get(`/api/tasks/calendar`);
      set({ calendarTasks: data });
    } catch (err) {
      console.error(err);
    }
  },

  fetchTeamTasks: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/api/tasks/team`);
      set({ teamTasks: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  createTask: async (data) => {
    set({ isLoading: true });
    try {
      const { data: created } = await api.post(`/api/tasks`, data);
      set({ isLoading: false });
      // Refresh list
      get().fetchTasks();
      return created;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  updateTask: async (id, data) => {
    try {
      const { data: updated } = await api.patch(`/api/tasks/${id}`, data);
      
      // Update in activeTask if it is open
      const currentActive = get().activeTask;
      if (currentActive && currentActive.id === id) {
        set({ activeTask: { ...currentActive, ...updated } });
      }

      // Update in tasks list
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t))
      }));

      // Refresh kanban state just in case
      get().fetchKanbanBoard();
      
      return updated;
    } catch (err) {
      throw err;
    }
  },

  deleteTask: async (id) => {
    try {
      await api.delete(`/api/tasks/${id}`);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        activeTask: state.activeTask?.id === id ? null : state.activeTask
      }));
      get().fetchKanbanBoard();
    } catch (err) {
      throw err;
    }
  },

  assignUser: async (taskId, userId) => {
    try {
      await api.post(`/api/tasks/${taskId}/assign`, { userId });
      get().fetchTaskById(taskId);
    } catch (err) {
      throw err;
    }
  },

  unassignUser: async (taskId, userId) => {
    try {
      await api.delete(`/api/tasks/${taskId}/assign/${userId}`);
      get().fetchTaskById(taskId);
    } catch (err) {
      throw err;
    }
  },

  addComment: async (taskId, content) => {
    try {
      const { data: comment } = await api.post(`/api/tasks/${taskId}/comments`, { content });
      const currentActive = get().activeTask;
      if (currentActive && currentActive.id === taskId) {
        set({
          activeTask: {
            ...currentActive,
            comments: [...(currentActive.comments || []), comment]
          }
        });
      }
      return comment;
    } catch (err) {
      throw err;
    }
  }
}));
export type TaskStatus = TaskData['status'];
export type TaskPriority = TaskData['priority'];
