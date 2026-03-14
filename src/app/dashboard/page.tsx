'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
}

interface Schedule {
  id: string;
  title: string;
  description: string | null;
  eventTime: string;
}

interface Conversation {
  id: string;
  sessionName: string;
  createdAt: string;
  summary?: string;
  isActive?: boolean;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ApiUsageItem {
  id: string;
  provider: string;
  model: string;
  success: boolean;
  fallbackUsed: boolean;
  createdAt: string;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('tasks');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '' });
  const [scheduleForm, setScheduleForm] = useState({ title: '', description: '', eventTime: '' });
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const { data: groupedTasks, error: tasksError, mutate: mutateTasks } = useSWR<Record<string, Task[]>>('/api/tasks?grouped=true', fetcher, { 
    refreshInterval: 3000,
    onSuccess: (data) => {
      if (data && Object.keys(data).length > 0) {
        const dates = Object.keys(data).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        if (dates.length > 0) {
          setExpandedDates(new Set([dates[0]]));
        }
      }
    }
  });

  const toggleDate = (date: string) => {
    const newSet = new Set(expandedDates);
    if (newSet.has(date)) {
      newSet.delete(date);
    } else {
      newSet.add(date);
    }
    setExpandedDates(newSet);
  };
  const { data: schedules, error: schedulesError, mutate: mutateSchedules } = useSWR<Schedule[]>('/api/schedules', fetcher, { refreshInterval: 3000 });
  const ADMIN_CHAT_ID = '1345151781';
  const { data: conversations, mutate: mutateConversations } = useSWR<Conversation[]>(`/api/conversations?chatId=${ADMIN_CHAT_ID}`, fetcher, { refreshInterval: 5000 });
  const { data: apiUsage, mutate: mutateApiUsage } = useSWR<ApiUsageItem[]>('/api/api-usage', fetcher, { refreshInterval: 5000 });

  const allTasks = groupedTasks ? Object.values(groupedTasks).flat() : [];
  const tasksArray = Array.isArray(allTasks) ? allTasks : [];
  const schedulesArray = Array.isArray(schedules) ? schedules : [];
  const conversationsArray = Array.isArray(conversations) ? conversations : [];
  const apiUsageArray = Array.isArray(apiUsage) ? apiUsage : [];
  
  const stats = {
    tasks: tasksArray.filter(t => t.status === 'pending').length || 0,
    schedules: schedulesArray.filter(s => new Date(s.eventTime) > new Date()).length || 0,
    sessions: conversationsArray.length || 0,
    apiCalls: apiUsageArray.length || 0,
  };

  const apiStats = {
    openrouter: apiUsageArray.filter(a => a.provider === 'openrouter').length || 0,
    gemini: apiUsageArray.filter(a => a.provider === 'gemini').length || 0,
    groq: apiUsageArray.filter(a => a.provider === 'groq').length || 0,
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) return;
    
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskForm),
    });
    
    setTaskForm({ title: '', description: '' });
    setShowTaskModal(false);
    mutateTasks();
  };

  const handleCreateSchedule = async () => {
    if (!scheduleForm.title.trim() || !scheduleForm.eventTime) return;
    
    await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleForm),
    });
    
    setScheduleForm({ title: '', description: '', eventTime: '' });
    setShowScheduleModal(false);
    mutateSchedules();
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await fetch(`/api/tasks?id=${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    mutateTasks();
  };

  const handleDeleteTask = async (id: string) => {
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    mutateTasks();
  };

  const handleDeleteSchedule = async (id: string) => {
    await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' });
    mutateSchedules();
  };

  const handleSelectConversation = async (conv: Conversation) => {
    const response = await fetch(`/api/conversations?id=${conv.id}`);
    const data = await response.json();
    setSelectedConversation(data.conversation);
    setConversationMessages(data.messages || []);
    setActiveTab('chat-detail');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">N</div>
          Nimbot
        </div>

        <nav className="nav-section">
          <div className="nav-label">Overview</div>
          <div className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Tasks
          </div>
          <div className={`nav-item ${activeTab === 'schedules' ? 'active' : ''}`} onClick={() => setActiveTab('schedules')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Schedules
          </div>
          <div className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Sessions
          </div>
        </nav>

        <nav className="nav-section">
          <div className="nav-label">System</div>
          <div className={`nav-item ${activeTab === 'api' ? 'active' : ''}`} onClick={() => setActiveTab('api')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            API Usage
          </div>
        </nav>

        <div style={{ marginTop: 'auto', padding: '20px 0' }}>
          <div className="refresh-indicator">
            <span className="refresh-dot"></span>
            Live sync active
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h1 className="header-title">
              {activeTab === 'tasks' && 'Tasks'}
              {activeTab === 'schedules' && 'Schedules'}
              {activeTab === 'sessions' && 'Sessions'}
              {activeTab === 'chat-detail' && 'Chat History'}
              {activeTab === 'api' && 'API Usage'}
            </h1>
            <p className="header-subtitle">
              {activeTab === 'tasks' && 'Manage your todo list'}
              {activeTab === 'schedules' && 'View and manage events'}
              {activeTab === 'sessions' && 'Chat history with AI'}
              {activeTab === 'api' && 'Track AI provider usage'}
            </p>
          </div>
        </header>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value tasks">{stats.tasks}</div>
            <div className="stat-label">Pending Tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value schedules">{stats.schedules}</div>
            <div className="stat-label">Upcoming Events</div>
          </div>
          <div className="stat-card">
            <div className="stat-value sessions">{stats.sessions}</div>
            <div className="stat-label">Chat Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value api">{stats.apiCalls}</div>
            <div className="stat-label">API Calls Today</div>
          </div>
        </div>

        {activeTab === 'tasks' && (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Tasks by Date</h2>
              <button className="btn btn-primary" onClick={() => setShowTaskModal(true)}>
                + Add Task
              </button>
            </div>
            
            {groupedTasks && Object.keys(groupedTasks).length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>No tasks yet. Add your first task!</p>
              </div>
            )}
            
            {groupedTasks && Object.keys(groupedTasks).length > 0 && Object.entries(groupedTasks).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime()).map(([date, dateTasks]) => (
              <div key={date} className="date-group">
                <div className="date-header" onClick={() => toggleDate(date)}>
                  <span className="date-label">
                    {(() => {
                      try {
                        const parsed = new Date(date);
                        if (isNaN(parsed.getTime())) return date;
                        return parsed.toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric',
                          year: 'numeric'
                        });
                      } catch {
                        return date;
                      }
                    })()}
                  </span>
                  <span className="date-count">{dateTasks.filter(t => t.status === 'pending').length} pending</span>
                  <span className="expand-icon">{expandedDates.has(date) ? '▼' : '▶'}</span>
                </div>
                
                {expandedDates.has(date) && (
                  <div className="date-tasks">
                    {dateTasks.map(task => (
                      <div key={task.id} className="item">
                        <div className="item-content">
                          <div className="item-title">{task.title}</div>
                          {task.description && <div className="item-meta">{task.description}</div>}
                        </div>
                        <span className={`item-status status-${task.status}`}>{task.status}</span>
                        <div className="item-actions">
                          <button className="icon-btn success" onClick={() => handleToggleTaskStatus(task)} title="Toggle status">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button className="icon-btn danger" onClick={() => handleDeleteTask(task.id)} title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">All Schedules</h2>
              <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
                + Add Schedule
              </button>
            </div>
            <div className="item-list">
              {schedulesArray.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <p>No schedules yet. Add your first event!</p>
                </div>
              ) : (
                schedulesArray.map(schedule => (
                  <div key={schedule.id} className="item">
                    <div className="item-content">
                      <div className="item-title">{schedule.title}</div>
                      <div className="item-meta">{formatDate(schedule.eventTime)}</div>
                    </div>
                    <div className="item-actions">
                      <button className="icon-btn danger" onClick={() => handleDeleteSchedule(schedule.id)} title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Chat Sessions</h2>
            </div>
            <div className="item-list">
              {conversationsArray.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <p>No chat sessions yet. Start chatting with your bot!</p>
                </div>
              ) : (
                conversationsArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(conv => (
                  <div 
                    key={conv.id} 
                    className="item clickable"
                    onClick={() => handleSelectConversation(conv)}
                  >
                    <div className="item-content">
                      <div className="item-title">
                        {conv.sessionName}
                        {conv.isActive && <span className="active-badge">Active</span>}
                      </div>
                      <div className="item-meta">{formatDate(conv.createdAt)}</div>
                      {conv.summary && <div className="item-summary">{conv.summary}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat-detail' && selectedConversation && (
          <div className="section">
            <div className="section-header">
              <button className="btn btn-secondary" onClick={() => setActiveTab('sessions')}>
                ← Back to Sessions
              </button>
              <h2 className="section-title">{selectedConversation.sessionName}</h2>
            </div>
            <div className="chat-messages">
              {conversationMessages && conversationMessages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.role}`}>
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">{formatDate(msg.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Provider Usage</h2>
            </div>
            <div className="api-stats">
              <div className="api-card openrouter">
                <div className="api-provider">OpenRouter</div>
                <div className="api-count">{apiStats.openrouter}</div>
                <div className="api-status">calls</div>
              </div>
              <div className="api-card gemini">
                <div className="api-provider">Gemini</div>
                <div className="api-count">{apiStats.gemini}</div>
                <div className="api-status">calls</div>
              </div>
              <div className="api-card groq">
                <div className="api-provider">Groq</div>
                <div className="api-count">{apiStats.groq}</div>
                <div className="api-status">calls</div>
              </div>
            </div>
          </div>
        )}
      </main>

      <div className={`modal-overlay ${showTaskModal ? 'active' : ''}`} onClick={() => setShowTaskModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3 className="modal-title">Add New Task</h3>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter task title"
              value={taskForm.title}
              onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-input form-textarea"
              placeholder="Add details..."
              value={taskForm.description}
              onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateTask}>Create Task</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${showScheduleModal ? 'active' : ''}`} onClick={() => setShowScheduleModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3 className="modal-title">Add New Schedule</h3>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Meeting with team"
              value={scheduleForm.title}
              onChange={e => setScheduleForm({ ...scheduleForm, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date & Time</label>
            <input
              type="datetime-local"
              className="form-input"
              value={scheduleForm.eventTime}
              onChange={e => setScheduleForm({ ...scheduleForm, eventTime: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-input form-textarea"
              placeholder="Add details..."
              value={scheduleForm.description}
              onChange={e => setScheduleForm({ ...scheduleForm, description: e.target.value })}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateSchedule}>Create Schedule</button>
          </div>
        </div>
      </div>
    </div>
  );
}
