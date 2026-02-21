# Faculty Feedback System

This project is a web-based Faculty Feedback System developed as a mini project to collect and manage student feedback for faculty members in a structured way.

It provides separate panels for Admin, Faculty, and Students and allows feedback submission, management, and report generation.

## 👥 Team

- Onkar Dhope
- Vivek Teware
- Aditya Jadhav

## 📌 Project Overview

The system simplifies the traditional feedback process by making it digital, organized, and easy to analyze.

- Students can log in and submit feedback subject-wise
- Faculty can view feedback summaries for their subjects
- Admin can manage students, faculty, subjects, and feedback settings
- Reports can be generated in PDF or CSV format

## ✨ Key Features

### 🔐 Role-Based Access
- Admin panel
- Faculty panel
- Student panel

### 👨‍🎓 Student Features
- Registration and login
- Submit subject-wise feedback
- Rating and comments
- One-time feedback restriction per subject

### 👨‍🏫 Faculty Features
- View feedback summary for assigned subjects
- Download reports

### 🧑‍💼 Admin Features
- Manage students and faculty
- Add divisions and subjects
- Assign faculty to subjects
- Open or close feedback window
- Restrict specific students from giving feedback
- Generate consolidated reports

### 📊 Reports
- Subject-wise summary (PDF / CSV)
- Division-wise consolidated report

## 🛠️ Tech Stack

Backend: Node.js, Express.js  
Database: MySQL  
Frontend: HTML, CSS, JavaScript  
PDF Generation: PDFKit  

## 📂 Project Structure

faculty-feedback/
├── public/          # Frontend files (HTML, CSS, JS)
├── routes/          # Express route handlers
├── utils/           # Helper modules
├── scripts/         # Utility scripts
├── db/              # Database files
├── app.js           # Main server file
├── package.json
└── README.md

## 🚀 How to Run Locally

1. Clone the repository

git clone https://github.com/<your-username>/<repo-name>.git  
cd <repo-name>

2. Install dependencies

npm install

3. Create a .env file in the root directory

DB_HOST=localhost  
DB_USER=root  
DB_PASS=your_password  
DB_NAME=FacultyFeedbackSystem  
PORT=3000  

4. Start the server

npm start

5. Open in browser

http://localhost:3000

## 📎 Note

This project was developed as part of an academic mini project and demonstrates a complete role-based web application with authentication, database integration, and report generation.