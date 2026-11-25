# Online Examination System – Frontend & Backend Integration

The Online Examination System has been added to the existing Expo React Native app and Express/Mongoose API without replacing the existing authentication, dashboards, classroom, chat, timetable, material, or notification modules.

## Frontend entry points

- Student dashboard → **Examinations**
  - Browse published exams
  - View exam schedule, instructions, marks and duration
  - Start/resume an attempt
  - Answer MCQ and descriptive questions
  - Automatic answer saving while answering
  - Countdown timer and submission
  - View attempt history and published results
- Faculty dashboard → **Examinations**
  - Create draft exams
  - Add MCQ and descriptive questions
  - Publish exams after the question marks equal the configured total marks
  - Review student submissions
  - Evaluate descriptive answers and provide feedback
  - Publish results
- Admin dashboard → **Online Examinations**
  - Opens the same management workspace; backend admin authorization permits system-wide exam management.

## API routes

All endpoints require the existing Bearer-token authentication middleware.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/examinations` | List exams available to the signed-in role |
| POST | `/api/examinations` | Create a draft exam (faculty/admin) |
| GET | `/api/examinations/:id` | Get exam details and questions |
| PUT | `/api/examinations/:id` | Update exam details |
| PATCH | `/api/examinations/:id/publish` | Publish an exam |
| PATCH | `/api/examinations/:id/cancel` | Cancel an exam |
| GET | `/api/examination-questions/:examId` | List questions |
| POST | `/api/examination-questions/:examId` | Add a question |
| PUT | `/api/examination-questions/:examId/:questionId` | Update a question |
| DELETE | `/api/examination-questions/:examId/:questionId` | Delete a question |
| POST | `/api/examination-attempts/:examId/start` | Start an exam |
| GET | `/api/examination-attempts/:attemptId` | Resume an existing student attempt |
| PUT | `/api/examination-attempts/:attemptId/answers` | Save answers |
| POST | `/api/examination-attempts/:attemptId/submit` | Submit an attempt |
| GET | `/api/examination-attempts/my-attempts` | Student attempt history |
| GET | `/api/examination-evaluation/:examId/submissions` | List submitted attempts |
| GET | `/api/examination-evaluation/:examId/attempts/:attemptId` | Get attempt for faculty review |
| PUT | `/api/examination-evaluation/:examId/attempts/:attemptId/evaluate` | Save descriptive evaluation |
| PATCH | `/api/examination-evaluation/:examId/attempts/:attemptId/publish` | Publish a result |
| GET | `/api/examination-evaluation/:examId/results` | View published results |

## Run locally

### Backend

```powershell
cd backend
npm install
# Create backend/.env using backend/.env.example and enter your own credentials.
npm run dev
```

### Frontend

```powershell
cd frontend
npm install
# frontend/.env should contain EXPO_PUBLIC_API_URL pointing to the API base URL.
npx expo start
```

For a physical phone, the API URL must be reachable from the phone (for example, your computer's LAN IP), not `localhost`. The provided frontend environment currently points to the configured Render API. Change it only if you want to test against another backend.

## Notes

- The backend calculates MCQ marks from the stored answer key; the frontend never receives correct answers during a student attempt.
- A student attempt is unique per student and exam in the current database model. Retakes are not implemented by the existing model even though the exam schema has an `allowRetake` field.
- A published result remains hidden from the student until the backend marks it as published, unless the exam's `showResultImmediately` setting permits immediate MCQ-only results.
- `backend/.env` is intentionally not included in the updated archive. Recreate it from `.env.example` and use your own secrets.
