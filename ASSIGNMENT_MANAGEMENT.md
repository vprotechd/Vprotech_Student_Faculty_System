# Assignment Management System

Added as an isolated module to the existing VProTech Student & Faculty Management System.

## Features

### Faculty
- Create assignments with title, description, instructions, optional course/semester/section targeting, deadline, maximum marks and an optional attachment.
- Save assignments as drafts and publish them.
- Edit assignments before a student has submitted work.
- Delete assignments only when no submissions exist (to preserve student records).
- Review student submissions, open uploaded files, grade work and provide feedback.

### Student
- View published assignments matching their course, semester and section.
- Open and download assignment attachments.
- Upload a submission file and optional note.
- Resubmit before grading; late submissions are recorded with `late` status.
- View submission status, marks and faculty feedback.

## Backend API

All endpoints require the existing Bearer-token authentication.

- `GET /api/assignments` — list assignments for the authenticated role.
- `POST /api/assignments` — faculty creates an assignment (multipart field `file` optional).
- `GET /api/assignments/:id` — get an assignment.
- `PUT /api/assignments/:id` — edit an assignment (multipart field `file` optional).
- `PATCH /api/assignments/:id/publish` — publish an assignment.
- `DELETE /api/assignments/:id` — delete an assignment if no submissions exist.
- `POST /api/assignments/:id/submit` — student submits a file (multipart field `file` required; `comment` optional).
- `GET /api/assignments/:id/submissions` — faculty/admin views submissions.
- `PATCH /api/assignments/:id/submissions/:submissionId/grade` — faculty/admin grades and gives feedback.
- `GET /api/assignments/my-submissions/:submissionId` — student retrieves their own submission.

Uploaded files use the project's existing Cloudinary credentials configured in `backend/.env`.

## Frontend routes

- Faculty: `/faculty/assignments`, `/faculty/assignments/create`, `/faculty/assignments/:assignmentId`, `/faculty/assignments/submissions/:assignmentId`
- Student: `/student/assignments`, `/student/assignments/:assignmentId`

The Faculty and Student dashboards now include an Assignments shortcut.

## Configuration

Copy `backend/.env.example` to `backend/.env` and set MongoDB, JWT and Cloudinary credentials. The existing `.env.example` already includes the Cloudinary variables. Do not commit `.env`.

The frontend uses the existing `EXPO_PUBLIC_API_URL` / default API configuration in `frontend/src/api/apiClient.js`.

## Notes

- Course targeting is optional. If course/semester/section are left blank, the assignment is visible to all active student profiles; set these fields to target a cohort.
- Students can replace a previous submission until it is graded.
- Faculty cannot edit assignments after the first submission, and assignments with submissions cannot be deleted, preserving evaluation history.
- File uploads are limited to 15 MB and supported PDF, Office, ZIP, TXT and image formats.
