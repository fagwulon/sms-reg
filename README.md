# Singles and Married Summit 2026 – Registration System (Alternative)

## Project Overview

An alternative web-based registration system for the Singles and Married Summit 2026.

The application allows attendees to register for the summit, submit their personal information, receive individual registration credentials, and optionally link their registration to their spouse through a secure invitation process.

This is an independent implementation intended to provide the event organizers with another option to evaluate.

## Technology Stack

### Backend
- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic

### Database
- PostgreSQL
- Supabase (managed PostgreSQL hosting)

### Frontend
- Developed independently by the frontend engineer.
- Frontend technology and implementation are maintained separately.
- Communicates with the backend through REST API endpoints.

### Version Control
- GitHub
- Shared repository
- Separate branches and pull requests for each developer

## Core Features

### 1. Attendee Registration
- Collect attendee information.
- Require gender selection: Male or Female.
- Require marital status.
- Validate submitted information before saving.
- Generate a unique registration ID for each attendee.
- Generate an individual QR code for each successful registration.

### 2. Spouse Linking
- Married attendees can register independently.
- A registered attendee can invite their spouse to link registrations.
- The invitation must use a secure, unique, time-limited token.
- The invited spouse must explicitly accept the invitation.
- Matching names alone must never automatically link two registrations.
- Both attendees retain separate registration IDs and QR codes.
- Each attendee's registration and attendance status remains independent.

### 3. Registration Confirmation
- Return a successful registration response.
- Provide registration ID and QR code information.
- Allow the frontend to display a confirmation page.

### 4. Organizer Management
The system should support authorized organizers managing registrations.

Expected capabilities:
- View registered attendees.
- Search and filter registrations.
- View individual registration details.
- View linked spouse registrations.
- Monitor registration statistics.
- Manage registration records through protected endpoints.

Administrative functionality must be protected by authentication and role-based access control.

## Registration Form Requirements

The registration form should collect the agreed attendee information, including:

- Full name
- Email address
- Phone number
- Gender (required: Male or Female)
- Marital status (required)
- Other event-specific registration fields agreed upon by the team.

For married attendees, spouse information should support the secure invitation workflow rather than automatic name matching.

The following sections are intentionally excluded:
- Breakout Sessions & Logistics
- Consent & Community

## Repository Structure

```text
sms-registration-alternative/
│
├── frontend/
│   └── (managed by frontend engineer)
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── core/
│   │   └── main.py
│   │
│   ├── tests/
│   ├── alembic/
│   ├── requirements.txt
│   └── .env.example
│
├── database/
│   └── README.md
│
├── README.md
└── .gitignore
```

The exact structure can be refined during implementation, but frontend and backend code must remain clearly separated.

## API Communication

The frontend communicates with the backend through HTTP REST APIs.

The backend should expose documented endpoints for:

- Attendee registration
- Registration retrieval
- Registration confirmation
- Spouse invitation creation
- Spouse invitation acceptance
- Organizer authentication
- Organizer registration management

All API request and response structures must be documented using FastAPI OpenAPI/Swagger documentation.

### API Base URL

Local development:

```text
http://localhost:8000
```

Production:

```text
https://your-backend-domain.com
```

The frontend engineer should configure the API base URL through an environment variable rather than hardcoding it.

## Environment Variables

Backend `.env` example:

```env
APP_ENV=development
DATABASE_URL=
SECRET_KEY=
FRONTEND_URL=
CORS_ORIGINS=
```

Never commit actual credentials, database passwords, secret keys, or private tokens to GitHub.

## Backend Setup

1. Clone the repository.
2. Navigate to the backend directory.
3. Create and activate a Python virtual environment.
4. Install dependencies.
5. Configure environment variables.
6. Run database migrations.
7. Start the FastAPI development server.

Example:

```bash
cd backend

python -m venv venv

source venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

API documentation:

```text
http://localhost:8000/docs
```

## Frontend Setup

The frontend engineer should:

1. Clone the shared repository.
2. Navigate to the frontend directory.
3. Install frontend dependencies.
4. Configure the backend API URL.
5. Start the frontend development server.

Frontend setup commands and dependencies should be documented by the frontend engineer once the frontend framework is established.

## Database

The application uses PostgreSQL hosted on Supabase.

The backend connects to Supabase PostgreSQL using SQLAlchemy.

Database migrations should be managed with Alembic.

The database should support:
- Attendee records
- Registration identifiers
- Spouse invitation records
- Spouse relationship records
- Organizer accounts and roles
- Registration and invitation timestamps

## Development Guidelines

### Shared Repository Rules

- Each developer should work on a separate feature branch.
- Avoid making changes directly to the main branch.
- Commit only files relevant to the assigned task.
- Open pull requests for code review.
- Communicate changes to shared API contracts before modifying them.
- Never commit `.env` files or secrets.
- Do not modify another developer's module without communicating first.

### Backend Engineer
Responsible for:
- FastAPI application
- API endpoints
- Business logic
- Validation
- Database integration
- Authentication and authorization
- Testing

### Frontend Engineer
Responsible for:
- Registration interface
- Form interactions
- Client-side validation
- API integration
- Confirmation interface
- Organizer interface

Both developers must agree on API request and response formats before integration.

## Testing

Backend tests should cover:
- Successful registration
- Invalid registration data
- Duplicate registration handling
- Unique registration ID generation
- Individual QR generation
- Spouse invitation creation
- Invitation expiration
- Invitation acceptance
- Prevention of unauthorized linking
- Organizer authorization
- Database integrity

## Deployment

The production application will consist of:

- Frontend hosting platform
- FastAPI backend hosting platform
- Supabase PostgreSQL database

Production environment variables, CORS settings, database connectivity, and HTTPS must be configured before launch.

## Project Objective

Deliver a reliable, secure, and easy-to-use alternative registration platform for Singles and Married Summit 2026.

The final application should provide a clear separation between frontend, backend, and database responsibilities while allowing both developers to work independently within one shared GitHub repository.
