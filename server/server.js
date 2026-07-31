const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_portal_key';

app.use(cors());
app.use(express.json());

// Helper to safely handle JSON parsing (handles both pre-parsed PG objects and raw strings)
function parseJsonField(field, defaultValue = {}) {
    if (!field) return defaultValue;
    if (typeof field === 'object') return field;
    try {
        return JSON.parse(field);
    } catch (e) {
        return defaultValue;
    }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access token required' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

// Role Authorization Middleware
function requireRole(roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Unauthorized role access' });
        }
        next();
    };
}

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/signup', async (req, res) => {
    const { email, password, role, register_number, name, department, year_semester, mentor_id } = req.body;
    if (!email || !password || !role || !name || !register_number || !department) {
        return res.status(400).json({ error: 'All primary fields are required' });
    }
    try {
        const existing = await db.get('SELECT id FROM users WHERE email = ? OR register_number = ?', [email, register_number]);
        if (existing) {
            return res.status(400).json({ error: 'User with this email or ID already exists' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);

        const result = await db.run(
            `INSERT INTO users (email, password_hash, role, register_number, name, department, year_semester, mentor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [email, hash, role, register_number, name, department, role === 'mentee' ? year_semester : null, role === 'mentee' ? (mentor_id || null) : null]
        );

        if (role === 'mentee') {
            await db.run(
                `INSERT INTO academic_progress (mentee_id, cgpa, gpa, attendance, internal_marks, backlogs)
                 VALUES (?, 0.0, 0.0, 100.0, '[]', 0)`,
                [result.id]
            );
        }

        res.status(201).json({ success: true, userId: result.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error registering user' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }
        
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                register_number: user.register_number,
                department: user.department,
                year_semester: user.year_semester
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await db.get(
            `SELECT u.*, m.name as mentor_name,
                    ap.cgpa, ap.gpa, ap.attendance, ap.backlogs, ap.reward_points
             FROM users u 
             LEFT JOIN users m ON u.mentor_id = m.id 
             LEFT JOIN academic_progress ap ON u.id = ap.mentee_id
             WHERE u.id = ?`, 
            [req.user.id]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({
            id: user.id,
            email: user.email,
            role: user.role,
            register_number: user.register_number,
            name: user.name,
            department: user.department,
            year_semester: user.year_semester,
            mentor_id: user.mentor_id,
            mentor_name: user.mentor_name,
            contact_details: parseJsonField(user.contact_details, {}),
            parent_details: parseJsonField(user.parent_details, {}),
            placement_status: user.placement_status,
            dob: user.dob,
            accommodation_type: user.accommodation_type,
            cgpa: user.cgpa,
            gpa: user.gpa,
            attendance: user.attendance,
            backlogs: user.backlogs,
            reward_points: user.reward_points
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving user data' });
    }
});

// --- LEAVE APPLICATION ROUTING ---
app.post('/api/leaves', authenticateToken, requireRole(['mentee']), async (req, res) => {
    const { start_date, end_date, reason } = req.body;
    if (!start_date || !end_date || !reason) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (start_date < todayStr) {
        return res.status(400).json({ error: 'Leave start date cannot be in the past' });
    }
    if (end_date < start_date) {
        return res.status(400).json({ error: 'End date cannot be prior to start date' });
    }

    try {
        // Overlap Check (Status is not Rejected)
        const overlap = await db.get(
            `SELECT id FROM leaves 
             WHERE mentee_id = ? AND status != 'Rejected' 
               AND start_date <= ? AND end_date >= ?`,
            [req.user.id, end_date, start_date]
        );

        if (overlap) {
            return res.status(400).json({ error: 'Overlap detected with another applied/approved leave session' });
        }

        const result = await db.run(
            `INSERT INTO leaves (mentee_id, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, 'Pending')`,
            [req.user.id, start_date, end_date, reason]
        );

        // Fetch student details to notify their mentor
        const studentInfo = await db.get(
            `SELECT name, mentor_id FROM users WHERE id = ?`,
            [req.user.id]
        );
        if (studentInfo && studentInfo.mentor_id) {
            await db.run(
                `INSERT INTO notifications (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
                [
                    req.user.id,
                    studentInfo.mentor_id,
                    `Student ${studentInfo.name} has applied for a leave from ${start_date} to ${end_date}. Reason: ${reason}`
                ]
            );
        }

        res.status(201).json({ id: result.id, success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error applying leave' });
    }
});

app.get('/api/leaves', authenticateToken, async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'mentee') {
            rows = await db.all(`SELECT * FROM leaves WHERE mentee_id = ? ORDER BY start_date DESC`, [req.user.id]);
        } else if (req.user.role === 'mentor') {
            // Get leaves of mentees assigned to this mentor
            rows = await db.all(
                `SELECT l.*, u.name as mentee_name, u.register_number as mentee_register
                 FROM leaves l
                 JOIN users u ON l.mentee_id = u.id
                 WHERE u.mentor_id = ?
                 ORDER BY l.start_date DESC`,
                [req.user.id]
            );
        } else {
            // Admin sees all leaves
            rows = await db.all(
                `SELECT l.*, u.name as mentee_name, u.register_number as mentee_register
                 FROM leaves l
                 JOIN users u ON l.mentee_id = u.id
                 ORDER BY l.start_date DESC`
            );
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/leaves/:id', authenticateToken, requireRole(['mentor', 'admin']), async (req, res) => {
    const { status } = req.body;
    try {
        const result = await db.run(
            `UPDATE leaves SET status = ? WHERE id = ?`,
            [status, req.params.id]
        );
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ONE-ON-ONE CHATS ---
app.post('/api/messages', authenticateToken, async (req, res) => {
    const { receiver_id, content } = req.body;
    if (!receiver_id || !content) {
        return res.status(400).json({ error: 'Receiver ID and content are required' });
    }
    try {
        const now = new Date().toISOString();
        const result = await db.run(
            `INSERT INTO messages (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?)`,
            [req.user.id, receiver_id, content, now]
        );

        const snippet = content.length > 50 ? content.substring(0, 50) + '...' : content;

        // 1. Notify the direct recipient of the chat message
        await db.run(
            `INSERT INTO notifications (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?)`,
            [req.user.id, receiver_id, `New message from ${req.user.name}: "${snippet}"`, now]
        );

        // 2. If the sender is a mentor and the recipient is not already an admin, notify all admins
        if (req.user.role === 'mentor') {
            const receiver = await db.get('SELECT role, name FROM users WHERE id = ?', [receiver_id]);
            if (receiver && receiver.role !== 'admin') {
                const receiverName = receiver.name;
                const receiverRole = receiver.role;
                const admins = await db.all("SELECT id FROM users WHERE role = 'admin'");
                for (const admin of admins) {
                    if (admin.id !== receiver_id) { // Avoid duplicates if admin is already the receiver
                        await db.run(
                            `INSERT INTO notifications (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?)`,
                            [req.user.id, admin.id, `New message from mentor ${req.user.name} to ${receiverRole} ${receiverName}: "${snippet}"`, now]
                        );
                    }
                }
            }
        }

        res.status(201).json({ id: result.id, sender_id: req.user.id, receiver_id, content, created_at: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/messages/:other_id', authenticateToken, async (req, res) => {
    const { other_id } = req.params;
    try {
        const rows = await db.all(
            `SELECT * FROM messages 
             WHERE (sender_id = ? AND receiver_id = ?) 
                OR (sender_id = ? AND receiver_id = ?)
             ORDER BY created_at ASC`,
            [req.user.id, other_id, other_id, req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- NOTIFICATIONS ---
app.post('/api/notifications', authenticateToken, requireRole(['admin', 'mentor']), async (req, res) => {
    const { receiver_id, content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Notification content is required' });
    }
    try {
        const now = new Date().toISOString();
        // If receiver_id is empty, it can be a general broadcast
        const result = await db.run(
            `INSERT INTO notifications (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?)`,
            [req.user.id, receiver_id || null, content, now]
        );
        res.status(201).json({ id: result.id, success: true, created_at: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'mentee') {
            // Mentees see notifications targeted to them, or broadcasts from their mentor/admin
            const self = await db.get('SELECT mentor_id FROM users WHERE id = ?', [req.user.id]);
            rows = await db.all(
                `SELECT n.*, u.name as sender_name 
                 FROM notifications n
                 JOIN users u ON n.sender_id = u.id
                 WHERE n.receiver_id = ? OR (n.receiver_id IS NULL AND (n.sender_id = ? OR u.role = 'admin'))
                 ORDER BY n.created_at DESC`,
                [req.user.id, self?.mentor_id]
            );
        } else if (req.user.role === 'mentor') {
            // Mentors see notifications from Admin or broadcasts (receiver_id is null or targeted to them)
            rows = await db.all(
                `SELECT n.*, u.name as sender_name 
                 FROM notifications n
                 JOIN users u ON n.sender_id = u.id
                 WHERE n.receiver_id = ? OR n.receiver_id IS NULL
                 ORDER BY n.created_at DESC`,
                [req.user.id]
            );
        } else {
            // Admin sees all sent alerts
            rows = await db.all(
                `SELECT n.*, u.name as sender_name FROM notifications n JOIN users u ON n.sender_id = u.id ORDER BY n.created_at DESC`
            );
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ANNOUNCEMENTS ---
app.get('/api/announcements', authenticateToken, async (req, res) => {
    try {
        let sql = `SELECT a.*, u.name as author_name 
                   FROM announcements a 
                   JOIN users u ON a.created_by = u.id`;
        let params = [];
        
        if (req.user.role === 'mentee') {
            sql += ` WHERE target_role IN ('all', 'mentee')`;
        } else if (req.user.role === 'mentor') {
            sql += ` WHERE target_role IN ('all', 'mentor')`;
        }
        
        sql += ` ORDER BY a.created_at DESC`;
        const rows = await db.all(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/announcements', authenticateToken, requireRole(['admin']), async (req, res) => {
    const { title, content, target_role } = req.body;
    try {
        const result = await db.run(
            `INSERT INTO announcements (title, content, target_role, created_by) VALUES (?, ?, ?, ?)`,
            [title, content, target_role, req.user.id]
        );
        res.status(201).json({ id: result.id, title, content, target_role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MEETINGS ---
app.get('/api/meetings', authenticateToken, async (req, res) => {
    try {
        let sql, params;
        if (req.user.role === 'mentee') {
            sql = `SELECT m.*, u.name as mentor_name, u.email as mentor_email 
                   FROM meetings m 
                   JOIN users u ON m.mentor_id = u.id 
                   WHERE m.mentee_id = ? 
                   ORDER BY m.date DESC, m.time DESC`;
            params = [req.user.id];
        } else if (req.user.role === 'mentor') {
            sql = `SELECT m.*, u.name as mentee_name, u.register_number as mentee_register 
                   FROM meetings m 
                   JOIN users u ON m.mentee_id = u.id 
                   WHERE m.mentor_id = ? 
                   ORDER BY m.date DESC, m.time DESC`;
            params = [req.user.id];
        } else {
            // Admin can see all meeting arrangements made by mentors
            sql = `SELECT m.*, mentor.name as mentor_name, mentee.name as mentee_name 
                   FROM meetings m 
                   JOIN users mentor ON m.mentor_id = mentor.id 
                   JOIN users mentee ON m.mentee_id = mentee.id 
                   ORDER BY m.date DESC, m.time DESC`;
            params = [];
        }
        const rows = await db.all(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/meetings', authenticateToken, requireRole(['mentor']), async (req, res) => {
    const { title, description, date, time, venue_link, mentee_id } = req.body;
    try {
        const result = await db.run(
            `INSERT INTO meetings (title, description, date, time, venue_link, status, mentor_id, mentee_id) 
             VALUES (?, ?, ?, ?, ?, 'Scheduled', ?, ?)`,
            [title, description, date, time, venue_link, req.user.id, mentee_id]
        );

        // Notify the mentee
        await db.run(
            `INSERT INTO notifications (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
            [
                req.user.id,
                mentee_id,
                `New meeting scheduled: "${title}" on ${date} at ${time}. Venue/Link: ${venue_link}`
            ]
        );

        res.status(201).json({ id: result.id, title, date, time, status: 'Scheduled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/meetings/:id', authenticateToken, async (req, res) => {
    const { status } = req.body;
    try {
        let result;
        // Fetch meeting details to notify the correct mentee
        const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
        
        if (req.user.role === 'mentor') {
            result = await db.run(
                `UPDATE meetings SET status = ? WHERE id = ? AND mentor_id = ?`,
                [status, req.params.id, req.user.id]
            );
        } else if (req.user.role === 'admin') {
            result = await db.run(
                `UPDATE meetings SET status = ? WHERE id = ?`,
                [status, req.params.id]
            );
        } else {
            return res.status(403).json({ error: 'Unauthorized to modify meetings' });
        }

        // Notify the mentee of status change if updated successfully
        if (meeting && result.changes > 0) {
            const senderId = req.user.id;
            await db.run(
                `INSERT INTO notifications (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
                [
                    senderId,
                    meeting.mentee_id,
                    `Meeting "${meeting.title}" scheduled for ${meeting.date} has been marked as ${status}.`
                ]
            );
        }

        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- TASKS ---
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        let sql, params;
        if (req.user.role === 'mentee') {
            sql = `SELECT t.*, u.name as mentor_name FROM tasks t 
                   JOIN users u ON t.assigned_by = u.id 
                   WHERE t.assigned_to = ? ORDER BY t.due_date ASC`;
            params = [req.user.id];
        } else if (req.user.role === 'mentor') {
            sql = `SELECT t.*, u.name as mentee_name, u.register_number as mentee_register 
                   FROM tasks t 
                   JOIN users u ON t.assigned_to = u.id 
                   WHERE t.assigned_by = ? ORDER BY t.due_date ASC`;
            params = [req.user.id];
        } else {
            sql = `SELECT t.* FROM tasks t ORDER BY t.due_date ASC`;
            params = [];
        }
        const rows = await db.all(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks', authenticateToken, requireRole(['mentor']), async (req, res) => {
    const { title, description, due_date, assigned_to } = req.body;
    try {
        const result = await db.run(
            `INSERT INTO tasks (title, description, due_date, status, assigned_to, assigned_by) 
             VALUES (?, ?, ?, 'Pending', ?, ?)`,
            [title, description, due_date, assigned_to, req.user.id]
        );
        res.status(201).json({ id: result.id, title, status: 'Pending' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { status, feedback } = req.body;
    try {
        let query = `UPDATE tasks SET `;
        let params = [];
        if (status) {
            query += `status = ?, `;
            params.push(status);
        }
        if (feedback && req.user.role === 'mentor') {
            query += `feedback = ?, `;
            params.push(feedback);
        }
        query = query.slice(0, -2); // Remove trailing comma and space
        
        if (req.user.role === 'mentee') {
            query += ` WHERE id = ? AND assigned_to = ?`;
            params.push(req.params.id, req.user.id);
        } else if (req.user.role === 'mentor') {
            query += ` WHERE id = ? AND assigned_by = ?`;
            params.push(req.params.id, req.user.id);
        } else {
            query += ` WHERE id = ?`;
            params.push(req.params.id);
        }

        const result = await db.run(query, params);
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ACADEMIC PROGRESS ---
app.get('/api/academic/:mentee_id', authenticateToken, async (req, res) => {
    const { mentee_id } = req.params;
    if (req.user.role === 'mentee' && Number(mentee_id) !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }
    try {
        const row = await db.get(`SELECT * FROM academic_progress WHERE mentee_id = ?`, [mentee_id]);
        if (row) {
            row.internal_marks = parseJsonField(row.internal_marks, []);
        }
        res.json(row || { error: 'Academic record not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MENTOR'S ASSIGNED MENTEES ---
app.get('/api/mentor/mentees', authenticateToken, requireRole(['mentor']), async (req, res) => {
    try {
        const rows = await db.all(
            `SELECT u.id, u.name, u.register_number, u.email, u.year_semester, u.department, u.placement_status,
                    a.cgpa, a.gpa, a.attendance, a.backlogs
             FROM users u
             LEFT JOIN academic_progress a ON u.id = a.mentee_id
             WHERE u.mentor_id = ? AND u.role = 'mentee'`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/mentor/admins', authenticateToken, requireRole(['mentor']), async (req, res) => {
    try {
        const rows = await db.all(
            `SELECT id, name, email, register_number, department FROM users WHERE role = 'admin'`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- GRIEVANCES / REQUESTS ---
app.get('/api/grievances', authenticateToken, async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'mentee') {
            rows = await db.all(
                `SELECT * FROM grievances WHERE student_id = ? ORDER BY created_at DESC`,
                [req.user.id]
            );
        } else {
            // Admin and Mentors see all grievances directly
            rows = await db.all(
                `SELECT g.*, u.name as student_name, u.register_number as student_register, u.department
                 FROM grievances g
                 JOIN users u ON g.student_id = u.id
                 ORDER BY g.created_at DESC`
            );
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/grievances', authenticateToken, requireRole(['mentee']), async (req, res) => {
    const { subject, description } = req.body;
    try {
        const result = await db.run(
            `INSERT INTO grievances (student_id, subject, description, status) VALUES (?, ?, ?, 'Pending')`,
            [req.user.id, subject, description]
        );

        // Notify all administrators
        const admins = await db.all("SELECT id FROM users WHERE role = 'admin'");
        const now = new Date().toISOString();
        for (const admin of admins) {
            await db.run(
                `INSERT INTO notifications (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?)`,
                [req.user.id, admin.id, `Grievance raised: "${subject}" by student ${req.user.name}`, now]
            );
        }

        res.status(201).json({ id: result.id, subject, status: 'Pending' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/grievances/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    const { status, response } = req.body;
    try {
        const result = await db.run(
            `UPDATE grievances 
             SET status = ?, response = ?, resolved_at = ? 
             WHERE id = ?`,
            [status, response, status === 'Resolved' ? new Date().toISOString() : null, req.params.id]
        );
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DOCUMENTS (With Download Support) ---
app.get('/api/documents', authenticateToken, async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'mentee') {
            rows = await db.all(`SELECT * FROM documents WHERE user_id = ?`, [req.user.id]);
        } else if (req.user.role === 'mentor') {
            rows = await db.all(
                `SELECT d.*, u.name as student_name 
                 FROM documents d
                 JOIN users u ON d.user_id = u.id
                 WHERE u.mentor_id = ?`,
                [req.user.id]
            );
        } else {
            rows = await db.all(
                `SELECT d.*, u.name as user_name FROM documents d JOIN users u ON d.user_id = u.id`
            );
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch documents for a specific student (used by Mentor/Admin)
app.get('/api/documents/:student_id', authenticateToken, requireRole(['mentor', 'admin']), async (req, res) => {
    try {
        const rows = await db.all(`SELECT * FROM documents WHERE user_id = ?`, [req.params.student_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/documents', authenticateToken, async (req, res) => {
    const { title, document_type, file_content } = req.body;
    try {
        // Save dummy content to simulate downloads
        const contentStr = file_content || `Mock document bytes for ${title} (${document_type})`;
        const result = await db.run(
            `INSERT INTO documents (user_id, title, file_path, document_type) VALUES (?, ?, ?, ?)`,
            [req.user.id, title, contentStr, document_type]
        );
        res.status(201).json({ id: result.id, title, document_type });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN USER & ALLOCATION MANAGEMENT ---
app.get('/api/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const users = await db.all(
            `SELECT u.*, mentor.name as mentor_name 
             FROM users u 
             LEFT JOIN users mentor ON u.mentor_id = mentor.id
             WHERE u.role != 'admin'` // Exclude admin/HOD details from general list
        );
        res.json(users.map(u => ({
            ...u,
            contact_details: parseJsonField(u.contact_details, {}),
            parent_details: parseJsonField(u.parent_details, {})
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
    const { email, password, role, register_number, name, department, year_semester, mentor_id } = req.body;
    try {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password || 'password123', salt);
        const result = await db.run(
            `INSERT INTO users (email, password_hash, role, register_number, name, department, year_semester, mentor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [email, hash, role, register_number, name, department, role === 'mentee' ? year_semester : null, role === 'mentee' ? (mentor_id || null) : null]
        );
        
        if (role === 'mentee') {
            await db.run(
                `INSERT INTO academic_progress (mentee_id, cgpa, gpa, attendance, internal_marks, backlogs) 
                 VALUES (?, 0.0, 0.0, 100.0, '[]', 0)`,
                [result.id]
            );
        }
        res.status(201).json({ id: result.id, email, name, role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk Insert Users Endpoint
app.post('/api/admin/users/bulk', authenticateToken, requireRole(['admin']), async (req, res) => {
    const { users } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: 'Users list must be a non-empty array' });
    }

    try {
        await db.run('BEGIN TRANSACTION');
        const insertedUsers = [];

        for (const user of users) {
            const { email, password, role, register_number, name, department, year_semester, mentor_id } = user;
            if (!email || !role || !register_number || !name || !department) {
                throw new Error(`Missing required fields for user: ${name || email}`);
            }

            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(password || 'password123', salt);

            const result = await db.run(
                `INSERT INTO users (email, password_hash, role, register_number, name, department, year_semester, mentor_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    email,
                    hash,
                    role,
                    register_number,
                    name,
                    department,
                    role === 'mentee' ? (year_semester || null) : null,
                    role === 'mentee' ? (mentor_id || null) : null
                ]
            );

            if (role === 'mentee') {
                await db.run(
                    `INSERT INTO academic_progress (mentee_id, cgpa, gpa, attendance, internal_marks, backlogs) 
                     VALUES (?, 0.0, 0.0, 100.0, '[]', 0)`,
                    [result.id]
                );
            }

            insertedUsers.push({ id: result.id, email, name, role });
        }

        await db.run('COMMIT');
        res.status(201).json({ success: true, count: insertedUsers.length, users: insertedUsers });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admin/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    const { mentor_id, placement_status, name, email, year_semester } = req.body;
    try {
        let query = 'UPDATE users SET ';
        let params = [];
        
        if (mentor_id !== undefined) {
            query += 'mentor_id = ?, ';
            params.push(mentor_id === "" ? null : mentor_id);
        }
        if (placement_status !== undefined) {
            query += 'placement_status = ?, ';
            params.push(placement_status);
        }
        if (name !== undefined) {
            query += 'name = ?, ';
            params.push(name);
        }
        if (email !== undefined) {
            query += 'email = ?, ';
            params.push(email);
        }
        if (year_semester !== undefined) {
            query += 'year_semester = ?, ';
            params.push(year_semester);
        }
        
        query = query.slice(0, -2) + ' WHERE id = ?';
        params.push(req.params.id);
        
        await db.run(query, params);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        await db.run(`DELETE FROM users WHERE id = ?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- FEEDBACK ---
app.post('/api/feedback', authenticateToken, requireRole(['mentor']), async (req, res) => {
    const { mentee_id, rating, comments } = req.body;
    try {
        const result = await db.run(
            `INSERT INTO feedback (mentor_id, mentee_id, rating, comments) VALUES (?, ?, ?, ?)`,
            [req.user.id, mentee_id, rating, comments]
        );
        res.status(201).json({ id: result.id, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/feedback/:mentee_id', authenticateToken, async (req, res) => {
    const { mentee_id } = req.params;
    if (req.user.role === 'mentee' && Number(mentee_id) !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }
    try {
        const rows = await db.all(
            `SELECT f.*, u.name as mentor_name 
             FROM feedback f 
             JOIN users u ON f.mentor_id = u.id 
             WHERE f.mentee_id = ? 
             ORDER BY f.feedback_date DESC`,
            [mentee_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ANALYTICS / OVERVIEW ---
app.get('/api/admin/analytics', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const totalUsers = await db.get(`SELECT COUNT(*) as count FROM users`);
        const totalMentors = await db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'mentor'`);
        const totalMentees = await db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'mentee'`);
        const totalGrievances = await db.get(`SELECT COUNT(*) as count FROM grievances`);
        const pendingGrievances = await db.get(`SELECT COUNT(*) as count FROM grievances WHERE status = 'Pending'`);
        
        const avgAttendance = await db.get(`SELECT AVG(attendance) as avg FROM academic_progress`);
        const avgCgpa = await db.get(`SELECT AVG(cgpa) as avg FROM academic_progress`);
        
        const placementPlaced = await db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'mentee' AND placement_status = 'Placed'`);
        const placementEligible = await db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'mentee' AND placement_status = 'Eligible'`);

        res.json({
            counts: {
                total: totalUsers.count,
                mentors: totalMentors.count,
                mentees: totalMentees.count,
                grievances: totalGrievances.count,
                pending_grievances: pendingGrievances.count
            },
            averages: {
                attendance: Math.round((avgAttendance.avg || 0) * 10) / 10,
                cgpa: Math.round((avgCgpa.avg || 0) * 100) / 100
            },
            placement: {
                placed: placementPlaced.count,
                eligible: placementEligible.count
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`Express API Server listening on port ${PORT}`);
});
