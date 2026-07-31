import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  BookOpen,
  Calendar,
  CheckSquare,
  FileText,
  MessageSquare,
  Bell,
  Users,
  LogOut,
  Plus,
  Trash2,
  CheckCircle,
  Award,
  Clock,
  Briefcase,
  UserCheck,
  Send,
  Sliders,
  FileUp,
  AlertTriangle,
  Download,
  Menu,
  X,
  UserPlus,
  CalendarDays,
  FileSpreadsheet,
  Sun,
  Moon
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// Helper to parse and format UTC SQLite timestamps in the user's local timezone
const getLocalTime = (utcString) => {
  if (!utcString) return '';
  let formatted = utcString;
  if (!utcString.includes('T') && !utcString.includes('Z')) {
    formatted = utcString.replace(' ', 'T') + 'Z';
  }
  return new Date(formatted).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getLocalTimeAndDate = (utcString) => {
  if (!utcString) return '';
  let formatted = utcString;
  if (!utcString.includes('T') && !utcString.includes('Z')) {
    formatted = utcString.replace(' ', 'T') + 'Z';
  }
  const d = new Date(formatted);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Registration Flow States
  const [isRegistering, setIsRegistering] = useState(false);
  const [regStep, setRegStep] = useState(1); // 1: Choose Role, 2: Fill Form
  const [regForm, setRegForm] = useState({
    email: '',
    password: '',
    role: 'mentee',
    register_number: '',
    name: '',
    department: 'Computer Science & Engineering',
    year_semester: '',
    mentor_id: ''
  });
  const [regSuccess, setRegSuccess] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Global Sync States
  const [announcements, setAnnouncements] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      fetchGlobalData();
      // Setup periodic polling for chats/notifications every 4 seconds
      const interval = setInterval(() => {
        fetchGlobalData();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [annRes, meetRes, taskRes, grievRes, docRes, leaveRes, alertRes] = await Promise.all([
        fetch(`${API_BASE}/announcements`, { headers }),
        fetch(`${API_BASE}/meetings`, { headers }),
        fetch(`${API_BASE}/tasks`, { headers }),
        fetch(`${API_BASE}/grievances`, { headers }),
        fetch(`${API_BASE}/documents`, { headers }),
        fetch(`${API_BASE}/leaves`, { headers }),
        fetch(`${API_BASE}/notifications`, { headers })
      ]);

      if (annRes.ok) setAnnouncements(await annRes.json());
      if (meetRes.ok) setMeetings(await meetRes.json());
      if (taskRes.ok) setTasks(await taskRes.json());
      if (grievRes.ok) setGrievances(await grievRes.json());
      if (docRes.ok) setDocuments(await docRes.json());
      if (leaveRes.ok) setLeaves(await leaveRes.json());
      if (alertRes.ok) setAlerts(await alertRes.json());
    } catch (err) {
      console.error('Error syncing portal records:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Could not connect to API server.');
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setRegSuccess('');
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      });
      const data = await res.json();
      if (res.ok) {
        setRegSuccess('Registration successful! You can now log in.');
        setIsRegistering(false);
        setRegStep(1);
        setEmail(regForm.email);
        setPassword(regForm.password);
      } else {
        setError(data.error || 'Sign-up failed');
      }
    } catch (err) {
      setError('Connection failure.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setActiveTab('dashboard');
  };

  const triggerDownload = (title, content) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.endsWith('.pdf') ? title : `${title}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f19' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-container">
        <div className="glass-panel login-card">
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ width: '180px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/login_logo.jpg" alt="MentiConnect Logo" style={{ width: '100%', height: 'auto', borderRadius: '8px', objectFit: 'contain' }} />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800' }}>MentiConnect</h2>
          </div>

          {regSuccess && (
            <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: 'var(--accent-emerald)', fontSize: '0.85rem', marginBottom: '20px' }}>
              {regSuccess}
            </div>
          )}

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '8px', color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!isRegistering ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input type="email" placeholder="email@institution.edu" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Password</label>
                <input type="password" placeholder="••••••••" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn" style={{ width: '100%', padding: '14px' }}>Sign In</button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--primary)' }} onClick={() => { setIsRegistering(true); setRegStep(1); }}>
                  Create an account (Sign Up)
                </button>
              </div>
            </form>
          ) : (
            <div>
              {regStep === 1 ? (
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px', textAlign: 'center' }}>Choose Your Portal Role</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button className="btn btn-secondary" style={{ padding: '16px', justifyContent: 'flex-start' }} onClick={() => { setRegForm({ ...regForm, role: 'mentee' }); setRegStep(2); }}>
                      🎓 Student / Mentee
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '16px', justifyContent: 'flex-start' }} onClick={() => { setRegForm({ ...regForm, role: 'mentor' }); setRegStep(2); }}>
                      👨‍🏫 Instructor / Mentor
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '16px', justifyContent: 'flex-start' }} onClick={() => { setRegForm({ ...regForm, role: 'admin' }); setRegStep(2); }}>
                      💼 HOD / Administrator
                    </button>
                  </div>
                  <button className="btn btn-secondary" style={{ width: '100%', marginTop: '20px' }} onClick={() => setIsRegistering(false)}>Back to Sign In</button>
                </div>
              ) : (
                <form onSubmit={handleSignUpSubmit}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px', textTransform: 'capitalize' }}>Sign Up Details - {regForm.role}</h4>

                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input type="text" className="form-input" required value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" required value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input type="password" className="form-input" required value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{regForm.role === 'mentee' ? 'Register Number' : 'Faculty ID'}</label>
                    <input type="text" className="form-input" required value={regForm.register_number} onChange={e => setRegForm({ ...regForm, register_number: e.target.value })} />
                  </div>

                  {regForm.role === 'mentee' && (
                    <div className="form-group">
                      <label className="form-label">Year & Semester</label>
                      <input type="text" placeholder="e.g. 3rd Year, 5th Sem" className="form-input" required value={regForm.year_semester} onChange={e => setRegForm({ ...regForm, year_semester: e.target.value })} />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRegStep(1)}>Back</button>
                    <button type="submit" className="btn" style={{ flex: 1 }}>Sign Up</button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand" style={{ flexDirection: 'column', gap: '4px', alignItems: 'center', padding: '12px 16px 8px', textAlign: 'center', position: 'relative' }}>
          <div className="brand-logo" style={{ width: '140px', height: '140px', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'none', margin: '0 auto', marginTop: '-8px' }}>
            <img src="/logo.png" alt="MentiConnect Logo" style={{ width: '130px', height: '130px', borderRadius: '50%', objectFit: 'cover' }} />
          </div>
          <span className="brand-name" style={{ marginLeft: 0, fontSize: '1.25rem', textAlign: 'center', width: '100%', fontWeight: '700', marginTop: '-4px' }}>MentiConnect</span>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} style={{ display: 'none', background: 'none', border: 'none', color: 'white', position: 'absolute', right: '16px', top: '16px' }}>
            <X size={20} />
          </button>
        </div>

        <ul className="sidebar-menu">
          <li className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}>
            <Sliders size={18} />
            <span>Dashboard</span>
          </li>

          {user.role === 'admin' && (
            <>
              <li className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}>
                <Users size={18} />
                <span>Mentors & Mentees</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'grievances' ? 'active' : ''}`} onClick={() => { setActiveTab('grievances'); setSidebarOpen(false); }}>
                <MessageSquare size={18} />
                <span>Grievances Center</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); setSidebarOpen(false); }}>
                <MessageSquare size={18} />
                <span>Mentor Chat</span>
              </li>
            </>
          )}

          {user.role === 'mentor' && (
            <>
              <li className={`sidebar-item ${activeTab === 'mentees' ? 'active' : ''}`} onClick={() => { setActiveTab('mentees'); setSidebarOpen(false); }}>
                <Users size={18} />
                <span>My Mentees</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'leaves' ? 'active' : ''}`} onClick={() => { setActiveTab('leaves'); setSidebarOpen(false); }}>
                <CalendarDays size={18} />
                <span>Leave Approvals</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'meetings' ? 'active' : ''}`} onClick={() => { setActiveTab('meetings'); setSidebarOpen(false); }}>
                <Calendar size={18} />
                <span>Meetings</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); setSidebarOpen(false); }}>
                <MessageSquare size={18} />
                <span>Mentee Chat</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'admin-chat' ? 'active' : ''}`} onClick={() => { setActiveTab('admin-chat'); setSidebarOpen(false); }}>
                <MessageSquare size={18} />
                <span>Admin Chat</span>
              </li>
            </>
          )}

          {user.role === 'mentee' && (
            <>
              <li className={`sidebar-item ${activeTab === 'leaves' ? 'active' : ''}`} onClick={() => { setActiveTab('leaves'); setSidebarOpen(false); }}>
                <CalendarDays size={18} />
                <span>Apply Leave</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'academic' ? 'active' : ''}`} onClick={() => { setActiveTab('academic'); setSidebarOpen(false); }}>
                <BookOpen size={18} />
                <span>Academics</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'meetings' ? 'active' : ''}`} onClick={() => { setActiveTab('meetings'); setSidebarOpen(false); }}>
                <Calendar size={18} />
                <span>Meetings</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => { setActiveTab('documents'); setSidebarOpen(false); }}>
                <FileText size={18} />
                <span>Certificates Repo</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'grievances' ? 'active' : ''}`} onClick={() => { setActiveTab('grievances'); setSidebarOpen(false); }}>
                <MessageSquare size={18} />
                <span>File Grievance</span>
              </li>
              <li className={`sidebar-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); setSidebarOpen(false); }}>
                <MessageSquare size={18} />
                <span>Chat Mentor</span>
              </li>
            </>
          )}
        </ul>

        <div className="sidebar-user">
          <div className="user-avatar">
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role}</div>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="main-viewport">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-toggle" onClick={() => setSidebarOpen(true)} style={{ display: 'none', background: 'none', border: 'none', color: 'white' }}>
              <Menu size={24} />
            </button>
            <h1 className="topbar-title">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Panel
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              style={{
                background: 'var(--primary-glow)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-smooth)'
              }}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
        </header>

        <div className="content-pane">
          {activeTab === 'dashboard' && <DashboardView user={user} announcements={announcements} meetings={meetings} tasks={tasks} grievances={grievances} refreshData={fetchGlobalData} token={token} alerts={alerts} />}
          {activeTab === 'users' && <AdminUsersView token={token} />}
          {activeTab === 'grievances' && <GrievancesView user={user} grievances={grievances} token={token} refreshData={fetchGlobalData} />}
          {activeTab === 'mentees' && <MentorMenteesView token={token} refreshData={fetchGlobalData} triggerDownload={triggerDownload} />}
          {activeTab === 'meetings' && <MeetingsView user={user} meetings={meetings} token={token} refreshData={fetchGlobalData} />}
          {activeTab === 'leaves' && <LeavesHubView user={user} leaves={leaves} token={token} refreshData={fetchGlobalData} />}
          {activeTab === 'academic' && <MenteeAcademicView user={user} token={token} />}
          {activeTab === 'documents' && <DocumentsView user={user} documents={documents} token={token} refreshData={fetchGlobalData} triggerDownload={triggerDownload} />}
          {activeTab === 'chat' && <OneToOneChatView user={user} token={token} chatMode="mentee" />}
          {activeTab === 'admin-chat' && <OneToOneChatView user={user} token={token} chatMode="admin" />}
        </div>
      </main>
    </div>
  );
}

// --- SUBVIEWS ---

function DashboardView({ user, announcements, meetings, tasks, grievances, refreshData, token, alerts }) {
  const [analytics, setAnalytics] = useState(null);
  const [newAlert, setNewAlert] = useState('');
  const [targetId, setTargetId] = useState('');
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    if (user.role === 'admin') {
      fetchAnalytics();
      fetchUsers();
    } else if (user.role === 'mentor') {
      fetchMentees();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setAnalytics(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUsersList(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMentees = async () => {
    try {
      const res = await fetch(`${API_BASE}/mentor/mentees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUsersList(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!newAlert.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          receiver_id: targetId || null,
          content: newAlert
        })
      });
      if (res.ok) {
        setNewAlert('');
        setTargetId('');
        alert('Notification sent!');
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-grid">
      <div className="glass-panel col-12" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(6, 182, 212, 0.05))' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Welcome, {user.name}</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
          {user.role === 'admin' && 'Central Administration dashboard. Reallocate mentees, manage mentors, and chat.'}
          {user.role === 'mentor' && 'Assigned students review board, meetings scheduler, and chats panel.'}
          {user.role === 'mentee' && `Dashboard. Linked with mentor ${user.mentor_name || 'HOD'}.`}
        </p>
      </div>

      {user.role === 'admin' && analytics && (
        <>
          <div className="glass-panel col-3 stat-card">
            <div>
              <div className="stat-label">System Accounts</div>
              <div className="stat-value">{analytics.counts.total}</div>
            </div>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}><Users size={24} /></div>
          </div>
          <div className="glass-panel col-3 stat-card">
            <div>
              <div className="stat-label">Active Mentors</div>
              <div className="stat-value">{analytics.counts.mentors}</div>
            </div>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)' }}><UserCheck size={24} /></div>
          </div>
          <div className="glass-panel col-3 stat-card">
            <div>
              <div className="stat-label">Active Mentees</div>
              <div className="stat-value">{analytics.counts.mentees}</div>
            </div>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}><Award size={24} /></div>
          </div>
          <div className="glass-panel col-3 stat-card">
            <div>
              <div className="stat-label">Open Grievances</div>
              <div className="stat-value">{analytics.counts.pending_grievances}</div>
            </div>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)' }}><MessageSquare size={24} /></div>
          </div>
        </>
      )}

      {user.role === 'mentee' && (
        <>
          <div className="glass-panel col-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', padding: '24px' }}>
            {/* Left Column: Student Profile Details */}
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--primary)' }}>Student Profile</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <p><strong>Name:</strong> {user.name}</p>
                <p><strong>Register Number:</strong> {user.register_number}</p>
                <p><strong>Accommodation:</strong> <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', fontWeight: '600' }}>{user.accommodation_type || 'Dayscholar'}</span></p>
                <p><strong>Date of Birth:</strong> {user.dob || 'N/A'}</p>
                <p><strong>Student Mobile:</strong> {user.contact_details?.phone || 'N/A'}</p>
                <p><strong>Address:</strong> {user.contact_details?.address || 'N/A'}</p>
              </div>
            </div>

            {/* Right Column: Guardian Details & Academic Rewards */}
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--accent-cyan)' }}>Guardian & Rewards</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <p><strong>Parent Name:</strong> {user.parent_details?.name || 'N/A'}</p>
                <p><strong>Parent Mobile:</strong> {user.parent_details?.phone || 'N/A'}</p>
                <p><strong>CGPA:</strong> {user.cgpa || '0.00'}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <strong>Reward Points:</strong>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '50px',
                    background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(202, 138, 4, 0.05))',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    color: '#eab308',
                    fontWeight: '700',
                    fontSize: '0.85rem'
                  }}>
                    <Award size={14} />
                    {user.reward_points || 0} pts
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '10px' }}>
            {/* CGPA Card */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.08)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cumulative GPA</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)', marginTop: '4px' }}>{user.cgpa || '0.00'}</div>
              </div>
              <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Award size={22} /></div>
            </div>

            {/* Backlogs Card */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(244, 63, 94, 0.03)', border: '1px solid rgba(244, 63, 94, 0.08)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Backlogs</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--accent-rose)', marginTop: '4px' }}>{user.backlogs ?? 0}</div>
              </div>
              <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={22} /></div>
            </div>

            {/* Attendance Status Card */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Attendance Status</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{user.attendance || 0}%</div>
                <div style={{ fontSize: '0.65rem', color: (user.attendance || 0) >= 75 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: '700', letterSpacing: '0.5px' }}>
                  {(user.attendance || 0) >= 75 ? '● ELIGIBLE' : '● DEBARRED'}
                </div>
              </div>

              {/* Mini circular progress indicator */}
              {(() => {
                const att = user.attendance || 0;
                const r = 26;
                const circ = 2 * Math.PI * r;
                const offset = circ - (att / 100) * circ;
                const col = att >= 75 ? 'var(--accent-emerald)' : 'var(--accent-rose)';
                return (
                  <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="30" cy="30" r={r} fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                      <circle
                        cx="30"
                        cy="30"
                        r={r}
                        fill="transparent"
                        stroke={col}
                        strokeWidth="6"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span style={{ position: 'absolute', fontSize: '0.7rem', fontWeight: '700' }}>{att}%</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Broadcast Alert Composer for Mentor/Admin */}
      {(user.role === 'admin' || user.role === 'mentor') && (
        <div className="glass-panel col-6">
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: '700' }}>Send Notification Alerts</h3>
          <form onSubmit={handleSendNotification}>
            <div className="form-group">
              <label className="form-label">Recipient User</label>
              <select className="form-input" value={targetId} onChange={e => setTargetId(e.target.value)}>
                <option value="">Broadcast to All Assigned</option>
                {user.role === 'admin' ? (
                  usersList.filter(u => u.role === 'mentor').map(u => (
                    <option key={u.id} value={u.id}>Mentor: {u.name}</option>
                  ))
                ) : (
                  usersList.map(u => (
                    <option key={u.id} value={u.id}>Mentee: {u.name}</option>
                  ))
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Alert Message</label>
              <input type="text" className="form-input" required value={newAlert} placeholder="Type announcement or alert details..." onChange={e => setNewAlert(e.target.value)} />
            </div>
            <button type="submit" className="btn" style={{ width: '100%' }}><Send size={16} /> Send Alert</button>
          </form>
        </div>
      )}

      {/* Announcements Board */}
      <div className={`glass-panel ${user.role === 'mentee' ? 'col-8' : 'col-6'}`}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: '700' }}>Notifications Box</h3>
        <div className="list-stack" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No recent notifications received.</div>
          ) : (
            alerts.map(a => {
              const isGrievance = a.content.toLowerCase().includes('grievance');
              const isMessage = a.content.toLowerCase().includes('message');

              let NotificationIcon = Bell;
              let iconColor = 'var(--primary)';
              let bgColor = 'rgba(59, 130, 246, 0.03)';
              let borderColor = 'rgba(59, 130, 246, 0.08)';

              if (isGrievance) {
                NotificationIcon = AlertTriangle;
                iconColor = 'var(--accent-rose)';
                bgColor = 'rgba(244, 63, 94, 0.04)';
                borderColor = 'rgba(244, 63, 94, 0.12)';
              } else if (isMessage) {
                NotificationIcon = MessageSquare;
                iconColor = 'var(--accent-cyan)';
                bgColor = 'rgba(6, 182, 212, 0.04)';
                borderColor = 'rgba(6, 182, 212, 0.12)';
              }

              return (
                <div
                  className="stack-item"
                  key={a.id}
                  style={{
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'center',
                    background: bgColor,
                    borderColor: borderColor,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: iconColor,
                    flexShrink: 0
                  }}>
                    <NotificationIcon size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: '500', lineHeight: '1.4', overflowWrap: 'break-word' }}>{a.content}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Sender: <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{a.sender_name}</span> • {getLocalTimeAndDate(a.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// --- LEAVES HUB VIEW (Apply Leaves & Approvals) ---
function LeavesHubView({ user, leaves, token, refreshData }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleApply = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ start_date: startDate, end_date: endDate, reason })
      });
      const data = await res.json();
      if (res.ok) {
        setStartDate('');
        setEndDate('');
        setReason('');
        alert('Leave application submitted!');
        refreshData();
      } else {
        setErrorMsg(data.error || 'Validation error applying leave.');
      }
    } catch (err) {
      setErrorMsg('Could not submit leave application.');
    }
  };

  const handleAction = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/leaves/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-grid">
      {user.role === 'mentee' && (
        <div className="glass-panel col-5">
          <h3 style={{ marginBottom: '16px' }}>Submit Leave Application</h3>
          {errorMsg && (
            <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} /> {errorMsg}
            </div>
          )}
          <form onSubmit={handleApply}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" required value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" required value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Reason / Narrative</label>
              <textarea className="form-input" rows={4} required placeholder="State leave necessity details..." value={reason} onChange={e => setReason(e.target.value)} style={{ fontFamily: 'inherit' }}></textarea>
            </div>
            <button type="submit" className="btn" style={{ width: '100%' }}>Submit Request</button>
          </form>
        </div>
      )}

      <div className={`glass-panel ${user.role === 'mentee' ? 'col-7' : 'col-12'}`}>
        <h3 style={{ marginBottom: '16px' }}>Leave Status Records</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {user.role !== 'mentee' && <th>Student</th>}
                <th>Start Date</th>
                <th>End Date</th>
                <th>Reason</th>
                <th>Status</th>
                {user.role !== 'mentee' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No leave records.</td>
                </tr>
              ) : (
                leaves.map(l => (
                  <tr key={l.id}>
                    {user.role !== 'mentee' && <td style={{ fontWeight: '600' }}>{l.mentee_name || `ID-${l.mentee_id}`}</td>}
                    <td>{l.start_date}</td>
                    <td>{l.end_date}</td>
                    <td>{l.reason}</td>
                    <td>
                      <span className={`badge ${l.status === 'Approved' ? 'badge-completed' : l.status === 'Rejected' ? 'badge-overdue' : 'badge-pending'}`}>
                        {l.status}
                      </span>
                    </td>
                    {user.role !== 'mentee' && (
                      <td>
                        {l.status === 'Pending' && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'var(--accent-emerald)' }} onClick={() => handleAction(l.id, 'Approved')}>Approve</button>
                            <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleAction(l.id, 'Rejected')}>Cancel</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- ADMIN USERS VIEW (Add/Remove Mentors/Mentees, Reallocate Mentees, Bulk Upload) ---
function AdminUsersView({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Individual Add Modal States
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'mentor',
    register_number: '',
    name: '',
    department: 'Computer Science & Engineering',
    year_semester: '',
    mentor_id: ''
  });

  // Bulk Upload Modal States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkRole, setBulkRole] = useState('mentee');
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setShowAddUser(false);
        setNewUser({
          email: '',
          password: '',
          role: 'mentor',
          register_number: '',
          name: '',
          department: 'Computer Science & Engineering',
          year_semester: '',
          mentor_id: ''
        });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add user');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to remove this user account?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReallocate = async (menteeId, mentorId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${menteeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mentor_id: mentorId })
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      setBulkError('Please select an Excel file first.');
      return;
    }
    setBulkError('');
    setBulkSuccess('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
          throw new Error('The Excel sheet appears to be empty.');
        }

        const formattedUsers = rows.map((row, idx) => {
          // Normalize object keys to lowercase, alphanumeric-only for flexible header matching
          const norm = {};
          Object.keys(row).forEach(k => {
            norm[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[k];
          });

          const name = norm['name'] || norm['fullname'] || norm['studentname'] || norm['mentorname'];
          const email = norm['email'] || norm['emailaddress'];
          const regNum = norm['facultyid'] || norm['facid'] || norm['registerid'] || norm['registernumber'] || norm['regid'] || norm['registerno'] || norm['empid'] || norm['employeeid'];
          const dept = norm['department'] || norm['dept'];
          const password = norm['password'] || 'password123';
          const yearSem = norm['yearsemester'] || norm['semester'] || norm['yearsem'];
          const mentorId = norm['mentorid'];

          if (!name || !email || !regNum || !dept) {
            throw new Error(`Row #${idx + 2} is missing required data. Make sure columns include: Name, Email, Faculty ID (or Register Number), and Department.`);
          }

          return {
            name: String(name).trim(),
            email: String(email).trim(),
            password: String(password).trim(),
            role: bulkRole,
            register_number: String(regNum).trim(),
            department: String(dept).trim(),
            year_semester: yearSem ? String(yearSem).trim() : '',
            mentor_id: mentorId ? Number(mentorId) : ''
          };
        });

        const res = await fetch(`${API_BASE}/admin/users/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ users: formattedUsers })
        });

        const result = await res.json();
        if (res.ok) {
          setBulkSuccess(`Successfully imported ${result.count} ${bulkRole}s!`);
          setBulkFile(null);
          const fileInput = document.getElementById('bulk-excel-input');
          if (fileInput) fileInput.value = '';
          fetchUsers();
        } else {
          setBulkError(result.error || 'Failed to upload bulk users to database.');
        }
      } catch (err) {
        setBulkError(err.message || 'Error processing Excel file.');
      }
    };

    reader.onerror = () => {
      setBulkError('Failed to read Excel file.');
    };

    reader.readAsBinaryString(bulkFile);
  };

  const mentors = users.filter(u => u.role === 'mentor');
  const mentees = users.filter(u => u.role === 'mentee');

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="dashboard-grid">
      {/* Admin Action Bar */}
      <div className="glass-panel col-12" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Admin Repository Manager</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Add, remove, reallocate, or bulk upload portal members.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn" onClick={() => {
            setNewUser({
              email: '',
              password: '',
              role: 'mentor',
              register_number: '',
              name: '',
              department: 'Computer Science & Engineering',
              year_semester: '',
              mentor_id: ''
            });
            setShowAddUser(true);
          }}>
            <UserPlus size={16} /> Add Individually
          </button>
          <button className="btn btn-secondary" onClick={() => {
            setBulkError('');
            setBulkSuccess('');
            setBulkFile(null);
            setShowBulkModal(true);
          }}>
            <FileSpreadsheet size={16} /> Bulk Upload (Excel)
          </button>
        </div>
      </div>

      {/* Mentors Table */}
      <div className="glass-panel col-12">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Mentors Repository</h3>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fac ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mentors.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: '600' }}>{m.register_number}</td>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>{m.department}</td>
                  <td>
                    <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleDeleteUser(m.id)}>
                      Remove Mentor
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mentees Table */}
      <div className="glass-panel col-12">
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '20px' }}>Mentees Repository</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Register No</th>
                <th>Name</th>
                <th>Department</th>
                <th>Assigned Mentor (Reallocation)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mentees.map(st => (
                <tr key={st.id}>
                  <td style={{ fontWeight: '600' }}>{st.register_number}</td>
                  <td>{st.name}</td>
                  <td>{st.department}</td>
                  <td>
                    <select className="form-input" style={{ padding: '4px 8px', fontSize: '0.85rem' }} value={st.mentor_id || ''} onChange={e => handleReallocate(st.id, e.target.value)}>
                      <option value="">Unassigned</option>
                      {mentors.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleDeleteUser(st.id)}>
                      Remove Student
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Add Modal */}
      {showAddUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 10px', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '95%', maxWidth: '500px', background: 'var(--bg-surface-solid)', margin: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>Add User Account</h3>
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="mentor">Mentor</option>
                  <option value="mentee">Mentee</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" placeholder="Default: password123" className="form-input" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{newUser.role === 'mentee' ? 'Register Number' : 'Faculty ID'}</label>
                <input type="text" className="form-input" required value={newUser.register_number} onChange={e => setNewUser({ ...newUser, register_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input type="text" className="form-input" required value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} />
              </div>
              {newUser.role === 'mentee' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Year & Semester</label>
                    <input type="text" className="form-input" placeholder="e.g. 3rd Year, 5th Sem" required value={newUser.year_semester} onChange={e => setNewUser({ ...newUser, year_semester: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assigned Mentor</label>
                    <select className="form-input" value={newUser.mentor_id} onChange={e => setNewUser({ ...newUser, mentor_id: e.target.value })}>
                      <option value="">Unassigned</option>
                      {mentors.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddUser(false)}>Cancel</button>
                <button type="submit" className="btn">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 10px', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '95%', maxWidth: '500px', background: 'var(--bg-surface-solid)', margin: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>Bulk User Upload</h3>
            <form onSubmit={handleBulkUpload}>
              <div className="form-group">
                <label className="form-label">Import Target Role</label>
                <select className="form-input" value={bulkRole} onChange={e => setBulkRole(e.target.value)}>
                  <option value="mentor">Mentors</option>
                  <option value="mentee">Mentees</option>
                </select>
              </div>

              <div style={{ margin: '20px 0', padding: '20px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
                <input
                  id="bulk-excel-input"
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={e => setBulkFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => document.getElementById('bulk-excel-input').click()}
                >
                  Choose Excel File
                </button>
                <p style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {bulkFile ? `Selected: ${bulkFile.name}` : 'Supported formats: .xlsx, .xls'}
                </p>
              </div>

              {bulkError && <p style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', marginBottom: '14px' }}>⚠️ {bulkError}</p>}
              {bulkSuccess && <p style={{ color: 'var(--accent-emerald)', fontSize: '0.8rem', marginBottom: '14px' }}>✅ {bulkSuccess}</p>}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Close</button>
                <button type="submit" className="btn" disabled={!bulkFile}>Import Data</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ONE-ON-ONE CHAT VIEW ---
function OneToOneChatView({ user, token, chatMode }) {
  const [relations, setRelations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    // Reset selected user when mode changes to prevent loading wrong chat
    setSelectedUser(null);
    setRelations([]);
    fetchChatUsers();
  }, [user, chatMode]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 2500); // Polling for messages
      return () => clearInterval(interval);
    }
  }, [selectedUser]);

  const fetchChatUsers = async () => {
    try {
      if (user.role === 'admin') {
        const res = await fetch(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const list = await res.json();
          setRelations(list.filter(u => u.role === 'mentor'));
        }
      } else if (user.role === 'mentor') {
        if (chatMode === 'admin') {
          // Fetch only admins
          const res = await fetch(`${API_BASE}/mentor/admins`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const list = await res.json();
            setRelations(list.map(a => ({ ...a, name: `${a.name}` })));
          }
        } else {
          // Fetch only mentees (students)
          const res = await fetch(`${API_BASE}/mentor/mentees`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const list = await res.json();
            setRelations(list.map(m => ({ ...m, name: `${m.name}` })));
          }
        }
      } else {
        // Mentee chats with their mentor
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const me = await res.json();
          if (me.mentor_id) {
            setRelations([{ id: me.mentor_id, name: me.mentor_name || 'My Mentor' }]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API_BASE}/messages/${selectedUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setMessages(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !selectedUser) return;
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ receiver_id: selectedUser.id, content: newMsg })
      });
      if (res.ok) {
        setNewMsg('');
        fetchMessages();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-grid" style={{ height: 'calc(100vh - 180px)' }}>
      {/* Sidebar List */}
      <div className="glass-panel col-4" style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Active Chats</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {relations.map(rel => (
            <div
              key={rel.id}
              onClick={() => setSelectedUser(rel)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: selectedUser?.id === rel.id ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedUser?.id === rel.id ? 'var(--primary)' : 'var(--border-color)'}`,
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
            >
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{rel.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {rel.role === 'admin' ? 'HOD / Administrator' : rel.role === 'mentor' ? `Fac ID: ${rel.register_number}` : `Reg No: ${rel.register_number}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className="glass-panel col-8" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {selectedUser ? (
          <>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{selectedUser.name}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {selectedUser.role === 'admin' ? 'Role: HOD / Portal Admin' : selectedUser.role === 'mentor' ? `Faculty ID: ${selectedUser.register_number}` : `Register No: ${selectedUser.register_number}`}
                {selectedUser.department && ` | Dept: ${selectedUser.department}`}
                {selectedUser.year_semester && ` | Sem: ${selectedUser.year_semester}`}
              </span>
            </div>

            {/* Messages box */}
            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0' }}>
              {messages.map(m => {
                const isMe = m.sender_id === user.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '70%',
                      background: isMe ? 'var(--primary)' : '#3b82f6',
                      color: 'white',
                      padding: '12px 16px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      fontSize: '0.95rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}
                  >
                    <div style={{ color: 'white' }}>{m.content}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                      {getLocalTime(m.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input box */}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
              <input type="text" className="form-input" style={{ flexGrow: 1 }} placeholder="Type message..." value={newMsg} onChange={e => setNewMsg(e.target.value)} />
              <button type="submit" className="btn"><Send size={16} /></button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Select an active chat session to start conversation.
          </div>
        )}
      </div>
    </div>
  );
}

// --- GRIEVANCE VIEW ---
function GrievancesView({ user, grievances, token, refreshData }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [response, setResponse] = useState('');

  const handleRaiseGrievance = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/grievances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subject, description })
      });
      if (res.ok) {
        setSubject('');
        setDescription('');
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveGrievance = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/grievances/${selectedGrievance.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Resolved', response })
      });
      if (res.ok) {
        setSelectedGrievance(null);
        setResponse('');
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-grid">
      {user.role === 'mentee' ? (
        <div className="glass-panel col-5">
          <h3 style={{ marginBottom: '20px' }}>Raise Request / Grievance</h3>
          <form onSubmit={handleRaiseGrievance}>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <input type="text" className="form-input" placeholder="e.g. Wi-Fi Connectivity Issue" required value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Elaborated Description</label>
              <textarea className="form-input" rows={6} placeholder="Provide details regarding the issue..." required value={description} onChange={e => setDescription(e.target.value)} style={{ fontFamily: 'inherit', resize: 'vertical' }}></textarea>
            </div>
            <button type="submit" className="btn" style={{ width: '100%' }}>Submit Grievance</button>
          </form>
        </div>
      ) : null}

      <div className={`glass-panel ${user.role === 'mentee' ? 'col-7' : 'col-12'}`}>
        <h3 style={{ marginBottom: '20px' }}>Grievance Records</h3>
        <div className="list-stack">
          {grievances.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              No grievances filed.
            </div>
          ) : (
            grievances.map(g => (
              <div className="stack-item" key={g.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontWeight: '600' }}>{g.subject}</h4>
                    {user.role !== 'mentee' && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Filed by: {g.student_name} ({g.student_register})
                      </p>
                    )}
                    <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>{g.description}</p>
                  </div>
                  <span className={`badge ${g.status === 'Resolved' ? 'badge-resolved' : 'badge-pending'}`}>{g.status}</span>
                </div>

                {g.response ? (
                  <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '3px solid var(--accent-cyan)', fontSize: '0.85rem' }}>
                    <strong>Admin Response:</strong> {g.response}
                  </div>
                ) : (
                  user.role === 'admin' && (
                    <button className="btn btn-secondary" style={{ marginTop: '14px', padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setSelectedGrievance(g)}>
                      Resolve Grievance
                    </button>
                  )
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedGrievance && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 10px', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '95%', maxWidth: '500px', background: 'var(--bg-surface-solid)', margin: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>Respond & Resolve Grievance</h3>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
              <strong>Subject:</strong> {selectedGrievance.subject} <br />
              <strong>Details:</strong> {selectedGrievance.description}
            </div>
            <form onSubmit={handleResolveGrievance}>
              <div className="form-group">
                <label className="form-label">Official Response / Solution</label>
                <textarea className="form-input" rows={4} required value={response} onChange={e => setResponse(e.target.value)} style={{ fontFamily: 'inherit', resize: 'vertical' }} placeholder="Provide steps taken to resolve..."></textarea>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedGrievance(null)}>Cancel</button>
                <button type="submit" className="btn">Mark Resolved</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- MENTOR'S MENTEES VIEW (Detailed Brief Separate Panels & Document Viewers) ---
function MentorMenteesView({ token, refreshData, triggerDownload }) {
  const [mentees, setMentees] = useState([]);
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [menteeDocs, setMenteeDocs] = useState([]);
  const [feedback, setFeedback] = useState({ rating: 5, comments: '' });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    fetchMentees();
  }, []);

  useEffect(() => {
    if (selectedMentee) {
      fetchMenteeDocs();
    }
  }, [selectedMentee]);

  const fetchMentees = async () => {
    try {
      const res = await fetch(`${API_BASE}/mentor/mentees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setMentees(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMenteeDocs = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents/${selectedMentee.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setMenteeDocs(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mentee_id: selectedMentee.id, ...feedback })
      });
      if (res.ok) {
        setShowFeedbackModal(false);
        setFeedback({ rating: 5, comments: '' });
        alert('Feedback logged!');
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-grid">
      {/* Sidebar List of Mentees */}
      <div className="glass-panel col-4" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: '700' }}>Assigned Mentees</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mentees.map(m => (
            <div
              key={m.id}
              onClick={() => setSelectedMentee(m)}
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: selectedMentee?.id === m.id ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedMentee?.id === m.id ? 'var(--primary)' : 'var(--border-color)'}`,
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{m.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{m.register_number} | {m.year_semester}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Details Brief Separate Panel */}
      <div className="glass-panel col-8">
        {selectedMentee ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{selectedMentee.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {selectedMentee.register_number} | Semester: {selectedMentee.year_semester}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CGPA</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>{selectedMentee.cgpa || '0.0'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--accent-emerald)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Attendance</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>{selectedMentee.attendance || '0.0'}%</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--accent-rose)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Placement</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>{selectedMentee.placement_status}</div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '10px' }}>Uploaded Certificates / Documents</h4>
              <div className="list-stack">
                {menteeDocs.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No uploaded files found.</p>
                ) : (
                  menteeDocs.map(d => (
                    <div key={d.id} className="stack-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>📄 {d.title}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Category: {d.document_type}</div>
                      </div>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.7rem' }} onClick={() => triggerDownload(d.title, d.file_path)}>
                        <Download size={14} /> Download
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Select a student to view details.
          </div>
        )}
      </div>

      {showFeedbackModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 10px', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '95%', maxWidth: '500px', background: 'var(--bg-surface-solid)', margin: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>Submit Performance Log</h3>
            <form onSubmit={handleFeedbackSubmit}>
              <div className="form-group">
                <label className="form-label">Review Rating</label>
                <select className="form-input" value={feedback.rating} onChange={e => setFeedback({ ...feedback, rating: Number(e.target.value) })}>
                  <option value={5}>5 - Outstanding</option>
                  <option value={4}>4 - Commendable</option>
                  <option value={3}>3 - Satisfactory</option>
                  <option value={2}>2 - Needs Review</option>
                  <option value={1}>1 - critical alert</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Guidance Review Notes</label>
                <textarea className="form-input" rows={4} required placeholder="Academic updates or review summary notes..." value={feedback.comments} onChange={e => setFeedback({ ...feedback, comments: e.target.value })} style={{ fontFamily: 'inherit' }}></textarea>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFeedbackModal(false)}>Cancel</button>
                <button type="submit" className="btn">Submit Review</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- MEETINGS VIEW ---
function MeetingsView({ user, meetings, token, refreshData }) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newMeet, setNewMeet] = useState({ title: '', description: '', date: '', time: '', venue_link: '', mentee_id: '' });
  const [mentees, setMentees] = useState([]);

  useEffect(() => {
    if (user.role === 'mentor') {
      fetchMentees();
    }
  }, []);

  const fetchMentees = async () => {
    try {
      const res = await fetch(`${API_BASE}/mentor/mentees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setMentees(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleScheduleMeeting = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newMeet)
      });
      if (res.ok) {
        setShowScheduleModal(false);
        setNewMeet({ title: '', description: '', date: '', time: '', venue_link: '', mentee_id: '' });
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/meetings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <div className="glass-panel" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Meetings arrangements</h2>
          {user.role === 'mentor' && (
            <button className="btn" onClick={() => setShowScheduleModal(true)}>
              <Plus size={16} /> Setup Session
            </button>
          )}
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title / Description</th>
                <th>Date & Time</th>
                <th>Participants / Mentor</th>
                <th>Venue / virtual Link</th>
                <th>Status</th>
                {user.role !== 'mentee' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {meetings.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: '600' }}>{m.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.description}</div>
                  </td>
                  <td>
                    <div>📅 {m.date}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🕒 {m.time}</div>
                  </td>
                  <td>{user.role === 'mentee' ? m.mentor_name : m.mentee_name}</td>
                  <td>{m.venue_link}</td>
                  <td>
                    <span className={`badge ${m.status === 'Completed' ? 'badge-completed' : m.status === 'Cancelled' ? 'badge-overdue' : 'badge-pending'}`}>
                      {m.status}
                    </span>
                  </td>
                  {user.role !== 'mentee' && (
                    <td>
                      {m.status === 'Scheduled' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn" style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: 'var(--accent-emerald)' }} onClick={() => handleUpdateStatus(m.id, 'Completed')}>Complete</button>
                          <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => handleUpdateStatus(m.id, 'Cancelled')}>Cancel</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showScheduleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 10px', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '95%', maxWidth: '500px', background: 'var(--bg-surface-solid)', margin: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>Schedule Session</h3>
            <form onSubmit={handleScheduleMeeting}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input type="text" className="form-input" required value={newMeet.title} onChange={e => setNewMeet({ ...newMeet, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Agenda</label>
                <textarea className="form-input" rows={3} value={newMeet.description} onChange={e => setNewMeet({ ...newMeet, description: e.target.value })} style={{ fontFamily: 'inherit' }}></textarea>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" required value={newMeet.date} onChange={e => setNewMeet({ ...newMeet, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input type="time" className="form-input" required value={newMeet.time} onChange={e => setNewMeet({ ...newMeet, time: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Virtual Link / Room</label>
                <input type="text" placeholder="e.g. Room 304 or Zoom link" className="form-input" required value={newMeet.venue_link} onChange={e => setNewMeet({ ...newMeet, venue_link: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Target Mentee</label>
                <select className="form-input" required value={newMeet.mentee_id} onChange={e => setNewMeet({ ...newMeet, mentee_id: e.target.value })}>
                  <option value="">Select Student</option>
                  {mentees.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.register_number})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                <button type="submit" className="btn">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// --- MENTEE ACADEMIC VIEW ---
function MenteeAcademicView({ user, token }) {
  const [academic, setAcademic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAcademic();
  }, []);

  const fetchAcademic = async () => {
    try {
      const res = await fetch(`${API_BASE}/academic/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setAcademic(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="spinner"></div>;

  // Pie chart variables
  const attendance = academic ? academic.attendance : 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (attendance / 100) * circumference;
  const attendanceColor = attendance >= 75 ? 'var(--accent-emerald)' : 'var(--accent-rose)';

  return (
    <div className="dashboard-grid">
      {academic ? (
        <>
          {/* Left Column: Vertical Stack of Indicators */}
          <div className="glass-panel col-5" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '10px' }}>Academic Metrics</h3>

            {/* CGPA Card */}
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cumulative GPA</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)', marginTop: '4px' }}>{academic.cgpa}</div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Award size={20} /></div>
            </div>

            {/* Backlogs Card */}
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(244, 63, 94, 0.03)', border: '1px solid rgba(244, 63, 94, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Backlogs</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--accent-rose)', marginTop: '4px' }}>{academic.backlogs}</div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={20} /></div>
            </div>

            {/* Attendance SVG Pie Chart */}
            <div style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Attendance Status</div>
              <div style={{ position: 'relative', width: '110px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="55" cy="55" r={radius} fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    fill="transparent"
                    stroke={attendanceColor}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                  />
                </svg>
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)' }}>{attendance}%</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '700', marginTop: '2px' }}>
                    {attendance >= 75 ? 'ELIGIBLE' : 'DEBARRED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Internal Marks (6 subjects) */}
          <div className="glass-panel col-7">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '20px' }}>Internal Marks</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Assessment Mark (100)</th>
                  </tr>
                </thead>
                <tbody>
                  {academic.internal_marks?.map((sub, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '500' }}>{sub.subject}</td>
                      <td style={{ fontWeight: '600', color: sub.marks >= 75 ? 'var(--accent-emerald)' : sub.marks >= 50 ? 'var(--accent-cyan)' : 'var(--accent-rose)' }}>{sub.marks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-panel col-12">Academic records could not be fetched.</div>
      )}
    </div>
  );
}

// --- DOCUMENTS VIEW (Upload Birth Certificate/Marksheet & Download) ---
function DocumentsView({ user, documents, token, refreshData, triggerDownload }) {
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: file.name,
          document_type: 'Certificate' // Defaulting category to 'Certificate' since uploader is simplified
        })
      });
      if (res.ok) {
        refreshData();
        alert(`Successfully uploaded: ${file.name}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-grid">
      {user.role === 'mentee' && (
        <div className="glass-panel col-5" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px', padding: '24px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', fontWeight: '700' }}>Add New Certificate</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '280px' }}>
            Click below to browse and upload your academic or external certificate PDF file directly.
          </p>
          <label className="btn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: 'var(--radius-md)' }}>
            <FileUp size={16} /> Upload Certificate
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}

      <div className={`glass-panel ${user.role === 'mentee' ? 'col-7' : 'col-12'}`}>
        <h3 style={{ marginBottom: '20px' }}>Repository Files</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document File</th>
                <th>Category</th>
                {user.role !== 'mentee' && <th>Student Account</th>}
                <th>Date Uploaded</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>No uploaded certificates found.</td>
                </tr>
              ) : (
                documents.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: '600' }}>📄 {d.title}</td>
                    <td><span className="badge badge-resolved">{d.document_type}</span></td>
                    {user.role !== 'mentee' && <td>{d.student_name || user.name}</td>}
                    <td>{new Date(d.uploaded_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => triggerDownload(d.title, d.file_path)}>
                        <Download size={14} /> Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- DYNAMIC PROGRESS GAUGES ---
function ProgressGauge({ value, max, label, color }) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="gauge-container">
      <svg width="90" height="90" className="gauge-circle">
        <circle className="gauge-bg" cx="45" cy="45" r={radius} />
        <circle
          className="gauge-fill"
          cx="45"
          cy="45"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          stroke={color}
        />
        <text className="gauge-text" x="45" y="45">
          {value}
        </text>
      </svg>
      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '8px' }}>{label}</span>
    </div>
  );
}
