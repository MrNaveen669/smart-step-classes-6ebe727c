# AI Test Builder

Build a production-ready, premium AI-powered Online Test Series Platform (like Testbook/Adda247/Oliveboard, but with unique premium design). This is Version 1 (MVP) — architect it so future features can be added without restructuring the database.

TECH STACK

- Frontend: React (Vite, JavaScript only, no TypeScript), Tailwind CSS, shadcn/ui, React Router, TanStack Query, React Hook Form, Framer Motion, Lucide Icons

- Backend: Supabase (Postgres database, Auth, Storage, Edge Functions)

- File storage: Supabase Storage for uploaded PDF/DOCX/DOC/TXT question banks

- AI: Use a Supabase Edge Function that calls an AI API to extract questions from uploaded documents (I will supply the AI API key as a secret)

AUTHENTICATION

- Only Admin has login (email/password via Supabase Auth)

- No student registration in V1 — students use the platform without an account

- Design the schema so student registration, Google login, and OTP login can be added later without breaking existing tables

CORE FLOW

Admin logs in → Dashboard → Create Subject → Create Chapters → Upload Question Bank (PDF/DOCX/DOC/TXT) → AI extracts questions → Admin reviews/edits questions in an editable table → Admin builds a Test Series from questions → Publish → Students browse subjects/tests → Read instructions → Take timed test → Auto-submit → View result → Review answers with explanations

ADMIN DASHBOARD

Stat cards: Total Subjects, Question Banks, Questions, Test Series, Published Tests, Draft Tests. Include charts, recent uploads, recent activity, and quick action buttons.

SUBJECT & CHAPTER MANAGEMENT

Admin can create/edit/delete/hide/publish Subjects (e.g. Programming, Cyber Security, Networking, Reasoning, English, GK, Current Affairs). Each Subject has Chapters (e.g. under Cyber Security: Linux, Networking, Burp Suite, SSRF, SQLi, XSS, CSRF).

QUESTION BANK UPLOAD & AI EXTRACTION

Admin uploads PDF/DOCX/DOC/TXT. An Edge Function sends the extracted text to an AI model and parses out: Question, Options, Correct Answer, Explanation, Difficulty (if present), Question Number, Question Type. It must correctly handle both formats — answer directly after each question, OR a separate answer key at the end (e.g. "1-C, 2-D, 3-A") — and map answers back to questions automatically. If the PDF is scanned/image-based, run OCR first, then extract.

Supported question types: Single Correct MCQ, Multiple Correct, True/False, Fill in the Blank, Numerical, Image-Based.

QUESTION EDITOR

After extraction, show an editable data table where admin can fix Question, Options, Correct Answer, Explanation, Marks, Negative Marks, Difficulty, and attach/replace Image. Support bulk actions: select multiple → move to another chapter, delete, duplicate, export, import.

TEST SERIES CREATOR

Fields: Test Name, Subject, Chapter, Questions, Duration, Total Marks, Passing Marks, Negative Marking, Shuffle Questions, Shuffle Options, Random Questions, Publish/Draft, Expiry Date.

Two question-selection modes: (1) manual selection, (2) auto-generate by difficulty mix (e.g. 50 Easy / 30 Medium / 20 Hard → 100-question paper).

STUDENT EXPERIENCE

- Landing page: modern glassmorphism, dark mode, responsive, search by subject/test, popular tests, latest tests, featured categories.

- Test-taking screen: large countdown timer, question number, color-coded question palette (Green = Answered, Red = Not Answered, Purple = Marked for Review, Grey = Not Visited), Previous/Next, Mark for Review, Clear Response, Submit. Auto-save answers locally, auto-submit when timer hits zero, and warn before accidental refresh/close.

- Result screen: Total Marks, Obtained Marks, Correct/Wrong/Skipped counts, Percentage, Accuracy, Time Taken, Pass/Fail.

- Answer review screen: per-question view of Question, Selected Answer, Correct Answer, Explanation, Marks Awarded, Time Spent.

SEARCH & FILTERS

Search by Subject, Chapter, Question, Test Name. Filters: Newest, Oldest, Easy, Medium, Hard, Free, Latest.

UI/UX DIRECTION

Premium design inspired by Apple, Stripe, Linear, Vercel, Notion — rounded corners, glassmorphism, soft shadows, minimal color palette, excellent typography and spacing, smooth Framer Motion animations, skeleton loaders, thoughtful empty states, floating action buttons where appropriate. Fully responsive on desktop/tablet/mobile with zero horizontal scroll.

DATABASE TABLES (Postgres via Supabase)

admins, subjects, chapters, question_banks, questions, test_series, test_attempts (for future use), plus schema headroom for future users, payments, and certificates tables — do not build these yet, just don't block them.

SECURITY & PERFORMANCE

Row Level Security so only authenticated admins can write; public read-only access for published content. Validate all file uploads (type + max size), rate-limit sensitive endpoints, lazy-load routes, paginate lists, debounce search.

CODE QUALITY

Reusable components, modular structure, clean naming, proper error handling and loading states everywhere, no hard-coded values, accessible (WCAG) markup.

Build this as a complete, working MVP end-to-end — not a static mockup.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://smart-step-classes.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a7f59ecb-6a36-4d2a-b149-5b771c0a6833).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
