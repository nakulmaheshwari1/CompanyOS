import React, { useEffect, useState, useRef } from 'react';
import { useTaskStore, TaskData, TaskStatus, TaskPriority } from '../store/taskStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import api from '../api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { classNames, formatDate } from '../utils/format';
import {
  List,
  Kanban,
  CalendarDays,
  Plus,
  ArrowRight,
  MessageSquare,
  Paperclip,
  CheckSquare,
  Clock,
  AlertCircle,
  Play,
  TrendingUp,
  UserPlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ListTodo
} from 'lucide-react';

export const TasksPage: React.FC = () => {
  const {
    tasks,
    kanbanTasks,
    calendarTasks,
    activeTask,
    fetchTasks,
    fetchTaskById,
    fetchKanbanBoard,
    fetchCalendarTasks,
    createTask,
    updateTask,
    deleteTask,
    assignUser,
    unassignUser,
    addComment
  } = useTaskStore();

  const {
    selectedTaskId,
    isTaskDrawerOpen,
    isCreateTaskModalOpen,
    setSelectedTaskId,
    setTaskDrawerOpen,
    setCreateTaskModalOpen
  } = useUIStore();

  const { user } = useAuthStore();

  // Navigation / View modes
  const [viewMode, setViewMode] = useState<'List' | 'Kanban' | 'Calendar'>('List');
  const [listTab, setListTab] = useState<'All' | 'Today' | 'Overdue' | 'Completed'>('All');
  const [listSort, setListSort] = useState<'dueDate' | 'priority' | 'lastUpdated'>('dueDate');

  // Directory users (for task assignments)
  const [directoryUsers, setDirectoryUsers] = useState<any[]>([]);

  // Create Task Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');
  const [newDueDate, setNewDueDate] = useState('');
  const [newEstHours, setNewEstHours] = useState<number>(0);
  const [newTags, setNewTags] = useState('');
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  // Comment Form State
  const [commentText, setCommentText] = useState('');

  // Mentions State
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionTriggerPos, setMentionTriggerPos] = useState(-1);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const handleCommentTextChange = (val: string, selectionStart: number | null) => {
    setCommentText(val);
    if (selectionStart === null) return;
    
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    
    if (lastAt !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      if (!/\s/.test(textAfterAt)) {
        setShowMentions(true);
        setMentionSearch(textAfterAt);
        setMentionTriggerPos(lastAt);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const filteredSuggestions = directoryUsers.filter(u =>
    u.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const insertMention = (targetUser: any) => {
    if (mentionTriggerPos === -1) return;
    const nameWithUnderscores = targetUser.name.replace(/\s+/g, '_');
    const beforeMention = commentText.slice(0, mentionTriggerPos);
    const afterMention = commentText.slice(commentInputRef.current?.selectionStart || commentText.length);
    const newText = `${beforeMention}@${nameWithUnderscores} ${afterMention}`;
    
    setCommentText(newText);
    setShowMentions(false);
    
    setTimeout(() => {
      if (commentInputRef.current) {
        commentInputRef.current.focus();
        const cursorPosition = mentionTriggerPos + nameWithUnderscores.length + 2;
        commentInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentions) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(prev => (prev + 1) % filteredSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredSuggestions.length > 0) {
        e.preventDefault();
        insertMention(filteredSuggestions[mentionIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentions(false);
    }
  };

  // Subtask Form State
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = useState(false);

  // Calendar Date helper states
  const [calendarDate, setCalendarDate] = useState(new Date());

  const loadData = async () => {
    // Load directory users for assignments list
    try {
      const { data } = await api.get('/api/users');
      setDirectoryUsers(data);
    } catch (err) {
      console.error(err);
    }

    if (viewMode === 'List') {
      fetchTasks(listTab, listSort);
    } else if (viewMode === 'Kanban') {
      fetchKanbanBoard();
    } else if (viewMode === 'Calendar') {
      fetchCalendarTasks();
    }
  };

  useEffect(() => {
    loadData();
  }, [viewMode, listTab, listSort]);

  // Load active task details when selectedTaskId changes
  useEffect(() => {
    if (selectedTaskId) {
      fetchTaskById(selectedTaskId);
    }
  }, [selectedTaskId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await createTask({
        title: newTitle,
        description: newDesc || null,
        priority: newPriority,
        dueDate: newDueDate || null,
        estimatedHours: newEstHours > 0 ? newEstHours : null,
        tags: newTags ? newTags.split(',').map(t => t.trim()) : [],
        assignees: newAssignees
      });

      // Clear Form & Close
      setNewTitle('');
      setNewDesc('');
      setNewPriority('MEDIUM');
      setNewDueDate('');
      setNewEstHours(0);
      setNewTags('');
      setNewAssignees([]);
      setCreateTaskModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create task.');
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskTitle || !activeTask) return;

    try {
      await api.post('/api/tasks', {
        title: subtaskTitle,
        parentTaskId: activeTask.id,
        // Inherit parent attributes
        priority: activeTask.priority,
        dueDate: activeTask.dueDate,
        assignees: activeTask.assignees.map(a => a.userId)
      });

      setSubtaskTitle('');
      setIsSubtaskFormOpen(false);
      
      // Reload active task
      fetchTaskById(activeTask.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText || !activeTask) return;

    try {
      await addComment(activeTask.id, commentText);
      setCommentText('');
    } catch (err) {
      console.error(err);
    }
  };

  // Drag & Drop Handlers (Kanban)
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      await updateTask(taskId, { status: targetStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'info';
      case 'MEDIUM': return 'warning';
      default: return 'neutral';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'IN_PROGRESS': return 'warning';
      case 'BLOCKED': return 'danger';
      case 'ON_HOLD': return 'info';
      default: return 'neutral';
    }
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const renderCalendarCells = () => {
    const daysInMonth = getDaysInMonth(calendarDate);
    const firstDay = getFirstDayOfMonth(calendarDate);
    const cells = [];

    // Empty blank cells before the first day of month
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="min-h-[90px] border border-[rgba(255,255,255,0.03)] bg-transparent" />);
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
      const cellDateStr = cellDate.toISOString().split('T')[0];

      // Filter tasks due on this date
      const dayTasks = calendarTasks.filter(t => t.dueDate && t.dueDate.startsWith(cellDateStr));

      cells.push(
        <div
          key={`day-${day}`}
          className="min-h-[90px] border border-[rgba(255,255,255,0.05)] bg-[#111111] p-1.5 flex flex-col justify-between hover:border-[rgba(0,230,118,0.25)] transition-colors"
        >
          <span className="text-[10px] font-mono font-bold text-text-secondary">{day}</span>
          <div className="flex-1 overflow-y-auto space-y-1 mt-1 scrollbar-none max-h-[60px]">
            {dayTasks.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTaskId(t.id)}
                className="w-full text-left truncate text-[9px] px-1 py-0.5 rounded bg-[#1C1C1C] border-l-2 border-[#00E676] text-white hover:bg-[#252525] font-sans block"
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return cells;
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 select-none">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-white uppercase">
            Task Orchestration
          </h2>
          <p className="text-xs text-text-secondary">
            Provision, schedule, and assign critical tasks and subtask dependencies.
          </p>
        </div>
        <div className="flex gap-2">
          {/* View Modes */}
          <div className="bg-[#111111] border border-[rgba(255,255,255,0.08)] p-1 rounded-lg flex gap-1">
            <button
              onClick={() => setViewMode('List')}
              className={classNames('p-1.5 rounded-md transition-colors', viewMode === 'List' ? 'bg-[#1C1C1C] text-[#00E676]' : 'text-text-secondary hover:text-white')}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('Kanban')}
              className={classNames('p-1.5 rounded-md transition-colors', viewMode === 'Kanban' ? 'bg-[#1C1C1C] text-[#00E676]' : 'text-text-secondary hover:text-white')}
              title="Kanban Board"
            >
              <Kanban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('Calendar')}
              className={classNames('p-1.5 rounded-md transition-colors', viewMode === 'Calendar' ? 'bg-[#1C1C1C] text-[#00E676]' : 'text-text-secondary hover:text-white')}
              title="Calendar Grid"
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>

          <Button onClick={() => setCreateTaskModalOpen(true)} variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            New Task
          </Button>
        </div>
      </div>

      {/* FILTER TABS & SORT (For List View) */}
      {viewMode === 'List' && (
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-[rgba(255,255,255,0.08)] pb-2 select-none gap-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-thin">
            {(['All', 'Today', 'Overdue', 'Completed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setListTab(tab)}
                className={classNames(
                  'px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap',
                  listTab === tab
                    ? 'border-[#00E676] text-[#00E676]'
                    : 'border-transparent text-text-secondary hover:text-white'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-text-secondary font-bold uppercase text-[10px] tracking-wider">Sort by</span>
            <select
              value={listSort}
              onChange={(e) => setListSort(e.target.value as any)}
              className="bg-[#111111] border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 rounded-lg text-white focus:outline-none focus:border-[#00E676] text-xs font-semibold"
            >
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="lastUpdated">Last Updated</option>
            </select>
          </div>
        </div>
      )}

      {/* VIEW: List View */}
      {viewMode === 'List' && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <Card hoverable={false} className="text-center py-16 text-xs text-text-secondary">
              No tasks matched your selection filter.
            </Card>
          ) : (
            tasks.map(task => (
              <Card
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className="flex items-center justify-between p-4 bg-[#161616] hover:border-[rgba(0,230,118,0.3)] transition-all cursor-pointer relative"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-6">
                  {/* Status Indicator Bar */}
                  <div className={classNames(
                    'w-1.5 h-10 rounded-full shrink-0',
                    task.status === 'COMPLETED' ? 'bg-status-success' : task.status === 'BLOCKED' ? 'bg-status-danger' : task.status === 'IN_PROGRESS' ? 'bg-status-warning' : 'bg-status-neutral'
                  )} />
                  <div className="truncate">
                    <h4 className="text-sm font-semibold text-white truncate group-hover:text-[#00E676] transition-colors mb-1">
                      {task.title}
                    </h4>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant={getPriorityBadgeVariant(task.priority)}>
                        {task.priority}
                      </Badge>
                      {task.dueDate && (
                        <span className="text-[10px] text-text-secondary font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Due {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task._count && task._count.comments > 0 && (
                        <span className="text-[10px] text-text-muted font-mono flex items-center gap-0.5">
                          <MessageSquare className="w-3 h-3" />
                          {task._count.comments}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assignees */}
                <div className="flex -space-x-2 shrink-0">
                  {task.assignees.slice(0, 3).map(asg => (
                    <Avatar
                      key={asg.userId}
                      src={asg.user.avatarUrl}
                      name={asg.user.name}
                      size="xs"
                      className="ring-2 ring-[#161616]"
                    />
                  ))}
                  {task.assignees.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[9px] font-bold text-text-secondary ring-2 ring-[#161616]">
                      +{task.assignees.length - 3}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* VIEW: Kanban Board */}
      {viewMode === 'Kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 select-none">
          {(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'ON_HOLD', 'COMPLETED'] as const).map(colStatus => {
            const colTasks = kanbanTasks[colStatus] || [];
            const colLabel = colStatus.replace('_', ' ');

            return (
              <div
                key={colStatus}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, colStatus)}
                className="flex flex-col bg-[#111111] border border-[rgba(255,255,255,0.04)] rounded-xl p-3 min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-[rgba(255,255,255,0.06)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                    {colLabel}
                  </span>
                  <Badge variant={getStatusBadgeVariant(colStatus)}>
                    {colTasks.length}
                  </Badge>
                </div>

                {/* Column Cards Container */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] scrollbar-none pr-0.5">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="bg-[#161616] border border-[rgba(255,255,255,0.08)] hover:border-[#00E676] rounded-lg p-3.5 cursor-grab active:cursor-grabbing transition-all space-y-2.5"
                    >
                      <h5 className="text-xs font-semibold text-white leading-snug">
                        {task.title}
                      </h5>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <Badge variant={getPriorityBadgeVariant(task.priority)}>
                          {task.priority}
                        </Badge>
                        
                        <div className="flex -space-x-1.5 shrink-0">
                          {task.assignees.slice(0, 2).map(asg => (
                            <Avatar
                              key={asg.userId}
                              src={asg.user.avatarUrl}
                              name={asg.user.name}
                              size="xs"
                              className="ring-1 ring-[#161616]"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW: Calendar View */}
      {viewMode === 'Calendar' && (
        <Card hoverable={false} className="p-4 flex flex-col">
          {/* Calendar Header Controls */}
          <div className="flex justify-between items-center mb-4 select-none">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-[#00E676]" />
              {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] p-0.5 rounded-lg">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-[#252525] rounded-md text-text-secondary hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleNextMonth} className="p-1 hover:bg-[#252525] rounded-md text-text-secondary hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] uppercase tracking-wider text-text-secondary mb-1">
            {weekdays.map(d => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {renderCalendarCells()}
          </div>
        </Card>
      )}

      {/* SLIDE-OVER DRAWER: Task Details */}
      <Drawer
        isOpen={isTaskDrawerOpen}
        onClose={() => setTaskDrawerOpen(false)}
        title={activeTask ? `Task Details` : 'Loading...'}
      >
        {activeTask && (
          <div className="space-y-6">
            
            {/* Title / Description */}
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white leading-normal">
                {activeTask.title}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed bg-[#161616] border border-[rgba(255,255,255,0.05)] p-3 rounded-lg min-h-[60px] whitespace-pre-wrap">
                {activeTask.description || 'No description provided.'}
              </p>
            </div>

            {/* Task parameters grid */}
            <div className="grid grid-cols-2 gap-4 bg-[#161616] p-4 rounded-xl border border-[rgba(255,255,255,0.05)] text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-text-secondary block mb-1">Status</span>
                <select
                  value={activeTask.status}
                  onChange={async (e) => {
                    await updateTask(activeTask.id, { status: e.target.value as any });
                    fetchTaskById(activeTask.id);
                  }}
                  className="bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] px-2 py-1 rounded text-white focus:outline-none focus:border-[#00E676] text-xs font-semibold"
                >
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-text-secondary block mb-1">Priority</span>
                <Badge variant={getPriorityBadgeVariant(activeTask.priority)}>
                  {activeTask.priority}
                </Badge>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-text-secondary block mb-1">Due Date</span>
                <span className="font-mono text-white font-semibold">
                  {activeTask.dueDate ? formatDate(activeTask.dueDate) : 'No due date'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-text-secondary block mb-1">Estimated Hours</span>
                <span className="font-mono text-white font-semibold">
                  {activeTask.estimatedHours ? `${activeTask.estimatedHours}h` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Assignee Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Assignees</span>
                
                {/* Quick Add Assignee Selection */}
                <select
                  value=""
                  onChange={async (e) => {
                    if (e.target.value) {
                      await assignUser(activeTask.id, e.target.value);
                    }
                  }}
                  className="bg-[#161616] border border-[rgba(255,255,255,0.08)] px-2 py-0.5 rounded text-white text-[10px]"
                >
                  <option value="">+ Assign User</option>
                  {directoryUsers
                    .filter(u => !activeTask.assignees.some(a => a.userId === u.id))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
              </div>

              <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                {activeTask.assignees.map(asg => (
                  <div key={asg.userId} className="flex items-center justify-between bg-[#161616] border border-[rgba(255,255,255,0.04)] px-3 py-1.5 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <Avatar src={asg.user.avatarUrl} name={asg.user.name} size="xs" />
                      <span className="text-white font-medium">{asg.user.name}</span>
                    </div>
                    <button
                      onClick={async () => {
                        await unassignUser(activeTask.id, asg.userId);
                      }}
                      className="text-[#FF3D3D] hover:text-[#FF2222]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtasks dependence list */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Subtask Checklist</span>
                <button
                  onClick={() => setIsSubtaskFormOpen(!isSubtaskFormOpen)}
                  className="text-[10px] text-[#00E676] hover:text-[#00C853] font-medium"
                >
                  {isSubtaskFormOpen ? 'Cancel' : '+ Subtask'}
                </button>
              </div>

              {isSubtaskFormOpen && (
                <form onSubmit={handleCreateSubtask} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    placeholder="Enter subtask title"
                    className="flex-1 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 rounded text-xs text-white placeholder-text-muted focus:outline-none focus:border-[#00E676]"
                    required
                  />
                  <Button type="submit" size="sm">Add</Button>
                </form>
              )}

              <div className="space-y-2">
                {(activeTask.subtasks || []).length === 0 ? (
                  <p className="text-xs text-text-secondary italic">No subtask checklists created.</p>
                ) : (
                  activeTask.subtasks?.map(sub => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2.5 bg-[#161616] p-2.5 rounded-lg border border-[rgba(255,255,255,0.04)] text-xs cursor-pointer hover:border-[rgba(0,230,118,0.25)]"
                      onClick={() => setSelectedTaskId(sub.id)}
                    >
                      <CheckSquare className={classNames('w-4 h-4', sub.status === 'COMPLETED' ? 'text-[#00E676]' : 'text-text-secondary')} />
                      <span className={classNames('flex-1 truncate', sub.status === 'COMPLETED' && 'line-through text-text-secondary')}>
                        {sub.title}
                      </span>
                      <Badge variant={getStatusBadgeVariant(sub.status)}>
                        {sub.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Comment Thread (Chronological Feed + Activity Logs) */}
            <div className="border-t border-[rgba(255,255,255,0.08)] pt-4 space-y-4 relative">
              <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider block">Comments & Activities</span>

              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {(activeTask.comments || []).length === 0 ? (
                  <p className="text-xs text-text-secondary italic">No comments or activities logged.</p>
                ) : (
                  activeTask.comments?.map(comm => {
                    const isActivity = comm.content.startsWith('[ACTIVITY]');
                    const displayText = isActivity ? comm.content.replace('[ACTIVITY] ', '') : comm.content;

                    return (
                      <div
                        key={comm.id}
                        className={classNames(
                          'p-2.5 rounded-lg text-xs leading-relaxed',
                          isActivity
                            ? 'bg-[#1C1C1C]/40 border-l-2 border-text-muted text-text-secondary text-[11px] italic'
                            : 'bg-[#161616] border border-[rgba(255,255,255,0.04)]'
                        )}
                      >
                        {!isActivity && (
                          <div className="flex justify-between items-center gap-2 mb-1.5">
                            <span className="font-semibold text-white">{comm.author.name}</span>
                            <span className="text-[10px] text-text-muted font-mono">{formatDate(comm.createdAt)}</span>
                          </div>
                        )}
                        <p className="text-white leading-normal">{displayText}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Mentions Autocomplete Dropdown */}
              {showMentions && filteredSuggestions.length > 0 && (
                <div className="absolute bottom-12 left-0 mb-2 w-64 bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl overflow-hidden z-50 max-h-48 overflow-y-auto scrollbar-thin">
                  {filteredSuggestions.map((u, idx) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => insertMention(u)}
                      className={classNames(
                        'w-full px-3 py-2 flex items-center gap-2.5 text-xs text-left transition-colors',
                        idx === mentionIndex ? 'bg-[#1B4332] text-white' : 'text-text-secondary hover:bg-[#1C1C1C] hover:text-white'
                      )}
                    >
                      <Avatar src={u.avatarUrl} name={u.name} size="xs" />
                      <div className="truncate">
                        <p className="font-semibold text-white truncate">{u.name}</p>
                        <p className="text-[10px] text-text-muted truncate">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Post Comment Input */}
              <form onSubmit={handlePostComment} className="flex gap-2">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => handleCommentTextChange(e.target.value, e.target.selectionStart)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question or use @username..."
                  className="flex-1 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] px-3 py-2 rounded-lg text-xs text-white placeholder-[#525252] focus:outline-none focus:border-[#00E676]"
                  required
                />
                <Button type="submit" size="sm">Post</Button>
              </form>
            </div>

            {/* Danger Zone: Delete Task */}
            <div className="border-t border-[rgba(255,255,255,0.08)] pt-4 select-none">
              <Button
                onClick={async () => {
                  if (confirm('Are you sure you want to delete this task?')) {
                    await deleteTask(activeTask.id);
                    setTaskDrawerOpen(false);
                  }
                }}
                variant="danger"
                size="sm"
                className="w-full flex items-center justify-center gap-1.5 uppercase font-bold text-[10px] tracking-wider"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Task
              </Button>
            </div>

          </div>
        )}
      </Drawer>

      {/* CREATE TASK MODAL */}
      <Modal isOpen={isCreateTaskModalOpen} onClose={() => setCreateTaskModalOpen(false)} title="Create New Task">
        {formError && (
          <div className="bg-[#3D1414] border border-[#FF3D3D]/20 text-[#FF3D3D] text-xs font-semibold px-4 py-3 rounded-lg mb-4">
            {formError}
          </div>
        )}
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input label="Task Title" placeholder="e.g. Implement user auth logic" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
          <Textarea label="Task Description" placeholder="Detailed requirements..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-lg text-white focus:outline-none focus:border-[#00E676] text-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <Input label="Due Date" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Est. Hours" type="number" min={0} value={newEstHours} onChange={(e) => setNewEstHours(parseInt(e.target.value) || 0)} />
            <Input label="Tags (comma separated)" placeholder="auth, frontend, docs" value={newTags} onChange={(e) => setNewTags(e.target.value)} />
          </div>

          {/* Direct selection list of users for initial assignment */}
          {user && (user.role === 'SUPER_ADMIN' || user.role === 'MANAGER') && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Assignees</label>
              <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto bg-[#161616] p-3 rounded-lg border border-[rgba(255,255,255,0.05)] scrollbar-thin">
                {directoryUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-xs text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newAssignees.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewAssignees([...newAssignees, u.id]);
                        } else {
                          setNewAssignees(newAssignees.filter(id => id !== u.id));
                        }
                      }}
                      className="rounded border-[rgba(255,255,255,0.08)] text-[#00E676] focus:ring-0 focus:ring-offset-0 bg-[#1C1C1C]"
                    />
                    <span>{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            <Button type="button" variant="ghost" onClick={() => setCreateTaskModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Create Task</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
export default TasksPage;
