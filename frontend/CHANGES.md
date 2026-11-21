# Frontend changes

## API layer
- src/api/apiClient.js: Android emulator URL (10.0.2.2), getErrorMessage(), onUnauthorized() (401 -> back to login).
- src/api/session.ts (new): getStoredUser() reads `userData` (what login saves) and `user`; logoutUser().
- src/api/facultyApi.ts: rewritten for the real backend routes (the old file imported a non-existent `apiClient` export and called routes that do not exist).
- src/api/studentApi.ts (new): student endpoints.

## Faculty
- faculty-dashboard: reads { todayLectures, pendingSubmissions, materialCount } + today's lectures; user name now loads.
- faculty/grading: real pending submissions + PATCH /submissions/:id/grade (was demo data + /grades).
- faculty/schedule: uses dayOfWeek / populated names; lectures tab with create + status update.
- faculty/profile: GET /faculty/me with stored-user fallback.
- faculty/upload-materials: /materials/faculty -> /materials/my.
- faculty/materials: was a broken duplicate (missing import); now re-exports upload-materials.

## Student (new)
- student-dashboard, student/timetable, student/materials, student/doubts, student/notifications, student/profile.
- src/components/portal.tsx shared UI, src/hooks/use-student.ts.
