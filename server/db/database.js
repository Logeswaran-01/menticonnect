const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbType = process.env.DB_TYPE || 'sqlite'; // Default to sqlite for local instant stability

let pool = null;
let sqliteDb = null;

if (dbType === 'postgres') {
    pool = new Pool({
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'mentor_mentee_portal',
        password: process.env.PGPASSWORD || 'password',
        port: parseInt(process.env.PGPORT || '5432'),
    });

    pool.connect((err, client, release) => {
        if (err) {
            console.error('PostgreSQL database connection error:', err.message);
            console.warn('\n======================================================');
            console.warn('ACTION REQUIRED: Please ensure:');
            console.warn('1. Your PostgreSQL server is running.');
            console.warn('2. The database "mentor_mentee_portal" has been created.');
            console.warn('3. The credentials inside server/.env are correct.');
            console.warn('======================================================\n');
        } else {
            console.log('Connected to PostgreSQL database successfully!');
            release();
            initDatabase();
        }
    });
} else {
    const dbPath = path.join(__dirname, 'portal.db');
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('SQLite connection error:', err);
        } else {
            console.log('Connected to SQLite database successfully at:', dbPath);
            initDatabase();
        }
    });
}

const schemaPath = dbType === 'postgres' 
    ? path.join(__dirname, 'schema.sql') 
    : path.join(__dirname, 'schema_sqlite.sql');

// Helper to convert SQLite style '?' placeholders to PostgreSQL style '$1', '$2', etc.
function convertPlaceholders(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
}

// Helper to translate MySQL schema dialect to PostgreSQL compatible schema dialect
function translateMySQLToPostgreSQL(mysqlSql) {
    let sql = mysqlSql;
    
    // Remove database creation and use commands (PostgreSQL handles connection-level database selection)
    sql = sql.replace(/CREATE DATABASE[^;]+;/gi, '');
    sql = sql.replace(/USE [^;]+;/gi, '');
    
    // Replace MySQL INT AUTO_INCREMENT PRIMARY KEY with PostgreSQL SERIAL PRIMARY KEY
    sql = sql.replace(/INT AUTO_INCREMENT PRIMARY KEY/gi, 'SERIAL PRIMARY KEY');
    sql = sql.replace(/INT AUTO_INCREMENT/gi, 'SERIAL');
    
    // Replace MySQL JSON type with standard TEXT/JSON
    // (PostgreSQL supports JSON natively, so leaving JSON is fine, but mapping inline ENUM to VARCHAR)
    sql = sql.replace(/ENUM\([^)]+\)/gi, 'VARCHAR(50)');
    
    // Remove MySQL engine specifications (ENGINE=InnoDB)
    sql = sql.replace(/\)\s*ENGINE\s*=\s*InnoDB\s*;/gi, ');');
    
    // Remove MySQL ON UPDATE CURRENT_TIMESTAMP modifier
    sql = sql.replace(/ON UPDATE CURRENT_TIMESTAMP/gi, '');
    
    return sql;
}

// Promise-based wrappers for database operations mapped to SQLite or PostgreSQL
async function run(sql, params = []) {
    if (dbType === 'postgres') {
        const convertedSql = convertPlaceholders(sql);
        let finalSql = convertedSql;
        
        // Append RETURNING id to INSERT statements to mimic SQLite's lastID return behavior
        if (sql.trim().toUpperCase().startsWith('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
            finalSql += ' RETURNING id';
        }
        
        const res = await pool.query(finalSql, params);
        return {
            id: res.rows[0] ? res.rows[0].id : null,
            changes: res.rowCount
        };
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }
}

async function get(sql, params = []) {
    if (dbType === 'postgres') {
        const convertedSql = convertPlaceholders(sql);
        const res = await pool.query(convertedSql, params);
        return res.rows[0] || null;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function all(sql, params = []) {
    if (dbType === 'postgres') {
        const convertedSql = convertPlaceholders(sql);
        const res = await pool.query(convertedSql, params);
        return res.rows;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

async function initDatabase() {
    try {
        const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
        const schema = dbType === 'postgres' ? translateMySQLToPostgreSQL(schemaRaw) : schemaRaw;
        
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            await run(statement);
        }
        console.log('Database tables verified/created successfully.');

        // Wipe all tables to remove leaves, meetings, chats, grievances and re-seed users fresh
        console.log('Cleaning up existing database records and history...');
        if (dbType === 'postgres') {
            await run('TRUNCATE TABLE leaves, meetings, tasks, messages, notifications, grievances, feedback, documents, academic_progress, users RESTART IDENTITY CASCADE;').catch(async () => {
                // Fallback if TRUNCATE fails
                await run('DELETE FROM leaves').catch(() => {});
                await run('DELETE FROM meetings').catch(() => {});
                await run('DELETE FROM tasks').catch(() => {});
                await run('DELETE FROM messages').catch(() => {});
                await run('DELETE FROM notifications').catch(() => {});
                await run('DELETE FROM grievances').catch(() => {});
                await run('DELETE FROM feedback').catch(() => {});
                await run('DELETE FROM documents').catch(() => {});
                await run('DELETE FROM academic_progress').catch(() => {});
                await run('DELETE FROM users').catch(() => {});
            });
        } else {
            await run('DELETE FROM leaves').catch(() => {});
            await run('DELETE FROM meetings').catch(() => {});
            await run('DELETE FROM tasks').catch(() => {});
            await run('DELETE FROM messages').catch(() => {});
            await run('DELETE FROM notifications').catch(() => {});
            await run('DELETE FROM grievances').catch(() => {});
            await run('DELETE FROM feedback').catch(() => {});
            await run('DELETE FROM documents').catch(() => {});
            await run('DELETE FROM academic_progress').catch(() => {});
            await run('DELETE FROM users').catch(() => {});
            await run("DELETE FROM sqlite_sequence WHERE name IN ('leaves','meetings','tasks','messages','notifications','grievances','feedback','documents','academic_progress','users')").catch(() => {});
        }

        console.log('Seeding initial data (1 Admin, 5 Mentors, 45 Mentees)...');
        await seedData();
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

async function seedData() {
    const salt = bcrypt.genSaltSync(10);
    const commonPasswordHash = bcrypt.hashSync('password123', salt);

    // 1. Insert 1 Admin
    const adminResult = await run(
        `INSERT INTO users (email, password_hash, role, register_number, name, department, contact_details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            'admin@institution.edu',
            commonPasswordHash,
            'admin',
            'ADM001',
            'Dr. Sarah Jenkins',
            'Computer Science & Engineering',
            JSON.stringify({ phone: '+1234567890', address: 'Admin Block, Room 101' })
        ]
    );

    // 2. Insert 5 Mentors
    const mentorNames = [
        'Prof. Alan Turing',
        'Prof. Barbara Liskov',
        'Prof. Donald Knuth',
        'Prof. Ada Lovelace',
        'Prof. Grace Hopper'
    ];

    const mentorIds = [];
    for (let i = 0; i < 5; i++) {
        const mentorEmail = `mentor${i + 1}@institution.edu`;
        const mentorEmpId = `EMP10${i + 1}`;
        const mentorResult = await run(
            `INSERT INTO users (email, password_hash, role, register_number, name, department, contact_details)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                mentorEmail,
                commonPasswordHash,
                'mentor',
                mentorEmpId,
                mentorNames[i],
                'Computer Science & Engineering',
                JSON.stringify({ phone: `+123456780${i}`, address: `Department Room ${201 + i}` })
            ]
        );
        mentorIds.push(mentorResult.id);
    }

    // 3. Insert 45 Mentees (9 assigned to each of the 5 mentors)
    const firstNames = ['John', 'Emma', 'Robert', 'Sophia', 'William', 'Olivia', 'James', 'Ava', 'Charles', 'Isabella', 'George', 'Mia', 'Edward', 'Charlotte', 'Frank', 'Amelia', 'Henry', 'Harper', 'Joseph', 'Evelyn', 'Arthur', 'Abigail', 'Harry', 'Emily', 'Richard', 'Elizabeth', 'Thomas', 'Sofia', 'David', 'Avery', 'Paul', 'Ella', 'Walter', 'Madison', 'Albert', 'Scarlett', 'Louis', 'Victoria', 'Stephen', 'Aria', 'Peter', 'Grace', 'Philip', 'Chloe', 'Alfred'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Lopez', 'Lee', 'Gonzalez', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Perez', 'Hall', 'Young', 'Allen', 'Sanchez', 'Wright', 'King', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Ramirez', 'Campbell', 'Mitchell', 'Roberts'];

    for (let i = 0; i < 45; i++) {
        const menteeEmail = `mentee${i + 1}@institution.edu`;
        const menteeRegNo = `REG90${i + 10}`;
        const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
        const mentorId = mentorIds[i % 5]; // distribute evenly
        const yearSem = `${((i % 4) + 1)}rd Year, Sem ${((i % 4) * 2) + 1}`;
        const placementStatus = i % 3 === 0 ? 'Placed' : (i % 3 === 1 ? 'Eligible' : 'Not Placed');

        const dob = `2004-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
        const accommodation = i % 2 === 0 ? 'Dayscholar' : 'Hosteller';

        const menteeResult = await run(
            `INSERT INTO users (email, password_hash, role, register_number, name, department, year_semester, mentor_id, contact_details, parent_details, placement_status, dob, accommodation_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                menteeEmail,
                commonPasswordHash,
                'mentee',
                menteeRegNo,
                name,
                'Computer Science & Engineering',
                yearSem,
                mentorId,
                JSON.stringify({ phone: `+180055501${String(i).padStart(2, '0')}`, address: `Campus Residence Hall Room ${i + 1}` }),
                JSON.stringify({ name: `Parent ${firstNames[i % firstNames.length]}`, phone: `+180055502${String(i).padStart(2, '0')}` }),
                placementStatus,
                dob,
                accommodation
            ]
        );

        // Academic record for each mentee
        const cgpa = Math.round((7.0 + (i % 3) * 0.9 + (i % 5) * 0.15) * 100) / 100;
        const gpa = Math.round(Math.min(cgpa + 0.2, 10.0) * 100) / 100;
        const attendance = Math.round((72.0 + (i % 4) * 8.5) * 10) / 10;
        const backlogs = i % 10 === 0 ? 1 : 0;
        const rewardPoints = Math.round(50 + (i % 8) * 15);

        await run(
            `INSERT INTO academic_progress (mentee_id, cgpa, gpa, attendance, internal_marks, backlogs, reward_points)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                menteeResult.id,
                cgpa,
                gpa,
                attendance,
                JSON.stringify([
                    { subject: 'Database Management Systems', marks: Math.round(60 + (i % 5) * 8) },
                    { subject: 'Computer Networks', marks: Math.round(65 + (i % 4) * 8) },
                    { subject: 'Design & Analysis of Algorithms', marks: Math.round(70 + (i % 3) * 9) },
                    { subject: 'Software Engineering', marks: Math.round(68 + (i % 5) * 6) },
                    { subject: 'Operating Systems', marks: Math.round(62 + (i % 4) * 7) },
                    { subject: 'Theory of Computation', marks: Math.round(58 + (i % 3) * 8) }
                ]),
                backlogs,
                rewardPoints
            ]
        );

        // Upload some default documents for some students
        if (i % 3 === 0) {
            await run(
                `INSERT INTO documents (user_id, title, file_path, document_type)
                 VALUES (?, ?, ?, ?)`,
                [menteeResult.id, 'Birth_Certificate.pdf', 'uploads/birth_cert.pdf', 'Birth Certificate']
            );
            await run(
                `INSERT INTO documents (user_id, title, file_path, document_type)
                 VALUES (?, ?, ?, ?)`,
                [menteeResult.id, 'Sem_1_Marksheet.pdf', 'uploads/marksheet_sem1.pdf', 'Marksheet']
            );
        }
    }

    // 4. Seeding Global announcements
    await run(
        `INSERT INTO announcements (title, content, target_role, created_by)
         VALUES (?, ?, ?, ?)`,
        [
            'Semester Fee Payment Notice',
            'All departments must finalize semester fee collections by next Thursday.',
            'all',
            adminResult.id
        ]
    );

    console.log('Seeding completed successfully!');
}

module.exports = {
    pool,
    run,
    get,
    all
};
