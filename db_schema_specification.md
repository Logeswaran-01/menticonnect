# MentiConnect: Database Schema & Dataset Specification

This document provides a detailed overview of the PostgreSQL database schema and the structure of seeded initial dataset values for the MentiConnect portal.

---

## 1. Table Definitions

### 👥 `users`
Stores user profile information, roles, and credentials.
- **Columns**:
  - `id` (`SERIAL PRIMARY KEY`)
  - `email` (`VARCHAR(255) UNIQUE NOT NULL`)
  - `password_hash` (`VARCHAR(255) NOT NULL`)
  - `role` (`VARCHAR(50) NOT NULL` - e.g., `'admin'`, `'mentor'`, `'mentee'`)
  - `register_number` (`VARCHAR(50) UNIQUE`)
  - `name` (`VARCHAR(255) NOT NULL`)
  - `department` (`VARCHAR(255)`)
  - `year_semester` (`VARCHAR(50)`)
  - `mentor_id` (`INT REFERENCES users(id)`)
  - `qualification` (`VARCHAR(100) DEFAULT 'M.E., Ph.D. in CSE'`)
  - `address` (`TEXT`)
  - `contact_details` (`JSONB` - holds phone and optional numbers)
  - `dob` (`DATE`)
  - `accommodation_type` (`VARCHAR(50)`)
  - `parent_details` (`JSONB`)

### 📈 `academic_progress`
Tracks student performance indices.
- **Columns**:
  - `id` (`SERIAL PRIMARY KEY`)
  - `mentee_id` (`INT UNIQUE REFERENCES users(id) ON DELETE CASCADE`)
  - `cgpa` (`DECIMAL(4,2)`)
  - `gpa` (`DECIMAL(4,2)`)
  - `attendance` (`DECIMAL(5,2)`)
  - `backlogs` (`INT DEFAULT 0`)
  - `reward_points` (`INT DEFAULT 0`)
  - `internal_marks` (`JSONB`)

### 📅 `meetings`
Tracks scheduled mentorship sessions.
- **Columns**:
  - `id` (`SERIAL PRIMARY KEY`)
  - `title` (`VARCHAR(255) NOT NULL`)
  - `description` (`TEXT`)
  - `date` (`DATE NOT NULL`)
  - `time` (`TIME NOT NULL`)
  - `venue_link` (`TEXT`)
  - `status` (`VARCHAR(50) DEFAULT 'Scheduled'`)
  - `mentor_id` (`INT REFERENCES users(id)`)
  - `mentee_id` (`INT REFERENCES users(id)`)

### 📝 `meeting_logs`
Logs completed session minutes.
- **Columns**:
  - `id` (`SERIAL PRIMARY KEY`)
  - `meeting_id` (`INT UNIQUE REFERENCES meetings(id) ON DELETE CASCADE`)
  - `discussion_points` (`TEXT NOT NULL`)
  - `action_items` (`TEXT`)
  - `mentor_comments` (`TEXT`)
  - `submitted_at` (`TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)

### ✈️ `mentor_reallocations`
Delegation logs for mentor absence periods.
- **Columns**:
  - `id` (`SERIAL PRIMARY KEY`)
  - `original_mentor_id` (`INT REFERENCES users(id)`)
  - `leave_reason` (`TEXT NOT NULL`)
  - `allocations` (`JSONB` - list of reallocated mentees and target mentors)
  - `status` (`VARCHAR(50) DEFAULT 'Pending'`)
  - `created_at` (`TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)

### ✉️ `messages`
One-to-one communication history.
- **Columns**:
  - `id` (`SERIAL PRIMARY KEY`)
  - `sender_id` (`INT REFERENCES users(id)`)
  - `receiver_id` (`INT REFERENCES users(id)`)
  - `content` (`TEXT NOT NULL`)
  - `created_at` (`TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)

---

## 2. Seeded Initial Dataset

The database automatically seeds default records on launch:

### 1. HOD/Admin User
- **Name**: `Dr. Sarah Jenkins`
- **Email**: `admin@domain.com`
- **Role**: `admin`
- **Qualification**: `M.E., Ph.D. in CSE, HOD`

### 2. Mentors (Faculty Profiles)
- **Prof. Alan Turing** (`turing@domain.com`)
- **Prof. Grace Hopper** (`hopper@domain.com`)
- **Prof. Ada Lovelace** (`lovelace@domain.com`)
- **Prof. Margaret Hamilton** (`hamilton@domain.com`)
- **Prof. Donald Knuth** (`knuth@domain.com`)

### 3. Mentees (Students)
- Seeds 45 student users assigned across the 5 mentors (9 students per mentor).
- **Academic Progress**: CGPA randomly generated between `5.50` and `9.80`, Attendance between `60%` and `98%`, and Reward Points between `10` and `120` points.
