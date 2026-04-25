# Grace Wise - AI-Powered Spiritual Growth Platform

A comprehensive web-based platform designed to support children's spiritual growth and development through interactive devotionals, curriculum planning, progress tracking, and AI-powered assistance.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Local Development (Windows + Laragon)](#local-development-windows--laragon)
- [API Endpoints](#api-endpoints)
- [Frontend Integration](#frontend-integration)
- [Usage Guide](#usage-guide)
- [Contributing](#contributing)

## 🎯 Overview

Grace Wise is built to help parents and educators nurture children's spiritual journeys through:
- Daily devotional content
- Age-appropriate curriculum
- Progress tracking and analytics
- AI-powered chatbot for spiritual guidance
- Task planning and management

## ✨ Features

### Backend Features
- **User Management**: User and child profile management
- **Devotionals**: Create, read, update, and delete devotional content
- **Progress Tracking**: Monitor child progress through devotionals
- **Curriculum Management**: Organize content by age groups and weeks
- **Planning System**: Task and goal management for children
- **AI Chatbot**: RAG-powered chatbot for answering spiritual questions from PDFs
- **Dashboard Analytics**: Overview of platform usage and progress

### Frontend Features
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Interactive UI**: Smooth animations and user-friendly interface
- **Real-time Updates**: Live data sync with backend API
- **Progress Visualization**: Charts and progress bars
- **Chat Interface**: Clean, intuitive chatbot interface
- **Admin Dashboard**: Management tools for administrators
- **Premium Plans**: Subscription-based premium features

## 🛠️ Tech Stack

### Backend
- **Framework**: Flask (Python)
- **Database**: MySQL (via PyMySQL)
- **ORM**: SQLAlchemy
- **AI/ML**: 
  - LangChain for RAG implementation
  - Groq & OpenAI for LLM
  - Sentence Transformers for embeddings
  - ChromaDB for vector storage
- **APIs**: RESTful API with Flask

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Responsive styling with flexbox/grid
- **JavaScript**: Vanilla JS for interactivity
- **Storage**: LocalStorage for client-side data persistence

## 📂 Project Structure

```
grace-wise/
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── models.py              # Database models
│   ├── requirements.txt        # Python dependencies
│   ├── backend_documentation.md
│   ├── documents/             # PDFs for RAG system
│   └── routes/
│       ├── dashboard.py       # Dashboard endpoints
│       ├── devotionals.py     # Devotional CRUD operations
│       ├── curriculum.py      # Curriculum management
│       ├── child_progress.py  # Progress tracking
│       ├── planner.py         # Task planning
│       └── rag_chatbot.py     # AI chatbot with RAG
├── frontend/
│   ├── index.html             # Homepage
│   ├── dashboard.html         # Dashboard page
│   ├── devotional.html        # Devotional page
│   ├── curriculum.html        # Curriculum page
│   ├── progress.html          # Progress tracking page
│   ├── ai-assistant.html      # AI chatbot interface
│   ├── premium-plan.html      # Premium subscription
│   ├── sign_in.html           # Login page
│   ├── sign_up.html           # Registration page
│   ├── css/                   # Stylesheets
│   ├── js/                    # JavaScript files
│   │   ├── api-config.js      # API configuration & helpers
│   │   ├── dashboard.js       # Dashboard logic
│   │   ├── devotional-integrated.js
│   │   ├── curriculum-integrated.js
│   │   ├── planner-integrated.js
│   │   ├── ai-assistant-integrated.js
│   │   ├── progress-integrated.js
│   │   ├── auth.js            # Authentication
│   │   └── script.js          # General utilities
│   └── assest/                # Images and icons
└── README.md
```

## 🚀 Installation & Setup

### Prerequisites
- Python 3.8+
- MySQL Server
- Node.js (optional, for frontend tooling)
- Git

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/GenAIwithMS/grace-wise.git
   cd grace-wise/backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   Create a `.env` file in the project root (or in `backend/.env`):
   ```
   FLASK_ENV=development
   FLASK_DEBUG=true
   HOST=127.0.0.1
   PORT=5000

   DB_USER=root
   DB_PASSWORD=
   DB_HOST=127.0.0.1
   DB_NAME=gracewise

   OPENAI_API_KEY=your_api_key_here
   # or
   GROQ_API_KEY=your_groq_key_here

   # Stripe subscriptions
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_PLAN_MONTHLY=price_plan_monthly_id
   STRIPE_PRICE_THRIVE_MONTHLY=price_thrive_monthly_id
   STRIPE_PRICE_TOGETHER_MONTHLY=price_together_monthly_id
   STRIPE_TRIAL_DAYS_DEFAULT=0
   FRONTEND_BASE_URL=http://127.0.0.1:8000

   # Optional SMTP for welcome/reset/payment emails
   SMTP_HOST=smtp.your-provider.com
   SMTP_PORT=587
   SMTP_USERNAME=your_username
   SMTP_PASSWORD=your_password
   SMTP_USE_TLS=true
   EMAIL_FROM=no-reply@gracewise.ai
   
   LANGCHAIN_TRACING_V2=false
   ```

5. **Set up database**
   - Create a MySQL database named `gracewise`
   - Update `app.py` with your database credentials:
     ```python
     app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://root:password@localhost/gracewise"
     ```

6. **Run the backend server**
   ```bash
   python app.py
   ```
   The backend will run on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Update API base URL** (if different from localhost:5000)
   - Edit `js/api-config.js`:
     ```javascript
     const API_BASE_URL = 'http://localhost:5000';
     ```

3. **Start a local server** (for development)
   ```bash
   python -m http.server 8000
   # Or use any other local server
   ```

4. **Open in browser**
   Navigate to `http://localhost:8000/index.html`

## Local Development (Windows + Laragon)

Follow these steps if you are running locally with Laragon.

1. **Start Laragon services**
   - Open Laragon and start `Apache/Nginx` and `MySQL`.

2. **Create database**
   ```sql
   CREATE DATABASE IF NOT EXISTS gracewise CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **Set `.env` correctly**
   - Use these DB values for common Laragon defaults:
   ```
   DB_USER=root
   DB_PASSWORD=
   DB_HOST=127.0.0.1
   DB_NAME=gracewise
   ```
   - If `SQLALCHEMY_DATABASE_URI` exists, make sure it matches your local MySQL credentials, otherwise remove it.
   - Note: the app loads both root `.env` and `backend/.env`. Keep values consistent to avoid conflicts.

4. **Run backend (Terminal 1)**
   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python app.py
   ```
   Backend URL: `http://127.0.0.1:5000`

5. **Run frontend (Terminal 2)**
   ```powershell
   cd frontend
   python -m http.server 8000
   ```
   Frontend URL: `http://127.0.0.1:8000/index.html`

6. **Open admin settings**
   - `http://127.0.0.1:8000/admin-settings.html`
   - From this page, admin can update/test OpenAI API key.

## 🔌 API Endpoints

### Dashboard
- `GET /dashboard/summary` - Get dashboard statistics

### Devotionals
- `GET /devotionals/` - Get all devotionals
- `POST /devotionals/` - Create new devotional
- `GET /devotionals/<id>` - Get specific devotional
- `PUT /devotionals/<id>` - Update devotional
- `DELETE /devotionals/<id>` - Delete devotional
- `POST /devotionals/<id>/complete` - Mark as completed

### Curriculum
- `GET /curriculum/` - Get all curriculum
- `POST /curriculum/` - Create curriculum
- `GET /curriculum/<id>` - Get specific curriculum
- `PUT /curriculum/<id>` - Update curriculum
- `DELETE /curriculum/<id>` - Delete curriculum

### Child Progress
- `POST /child_progress/add_child` - Add new child
- `GET /child_progress/<child_id>` - Get progress summary
- `GET /child_progress/<child_id>/details` - Get detailed progress

### Planner
- `GET /planner/<child_id>` - Get child's plans
- `POST /planner/` - Create new plan
- `PATCH /planner/<plan_id>` - Update plan
- `DELETE /planner/<plan_id>` - Delete plan

### Authentication
- `POST /auth/signup` - Register account (welcome email)
- `POST /auth/login` - Login and get JWT
- `GET /auth/me` - Current user profile + subscription state
- `POST /auth/forgot-password` - Request reset link email
- `GET /auth/reset-password/validate?token=...` - Validate reset token
- `POST /auth/reset-password` - Reset password with token

### Billing & Subscriptions (Stripe)
- `GET /billing/plans` - List monthly plans
- `GET /billing/subscription` - Current subscription status
- `POST /billing/checkout-session` - Create secure Stripe Checkout session
- `POST /billing/change-plan` - Upgrade/downgrade subscription
- `POST /billing/cancel` - Cancel subscription
- `POST /billing/retry-payment` - Retry failed invoice payment
- `POST /billing/portal-session` - Open Stripe billing portal (card updates, invoices)
- `POST /billing/webhook` - Stripe webhook handler

### Onboarding
- `GET /onboarding/questions` - Get core + tier-specific onboarding questions
- `GET /onboarding/me` - Get saved onboarding answers
- `POST /onboarding/me` - Save onboarding answers

### RAG Chatbot
- `POST /rag/ask` - Ask question to AI chatbot

## 🔗 Frontend Integration

### Setup API Integration

1. **Include API configuration in HTML files**
   ```html
   <script src="js/api-config.js"></script>
   <script src="js/devotional-integrated.js"></script>
   ```

2. **Using API functions in JavaScript**
   ```javascript
   // Get all devotionals
   const devotionals = await devotionalsAPI.getAll();
   
   // Create new devotional
   await devotionalsAPI.create({
       title: "New Devotional",
       content: "Content here",
       date: "2024-01-31"
   });
   
   // Get child progress
   const progress = await childProgressAPI.getProgress(childId);
   ```

3. **Child ID Management**
   - Child ID is stored in LocalStorage
   - Set when user logs in or navigates to child-specific pages
   - Accessed via: `localStorage.getItem('childId')`

## 📖 Usage Guide

### For Parents/Teachers

1. **Dashboard**
   - View overall platform statistics
   - See children's progress at a glance

2. **Devotionals**
   - Assign devotionals to children
   - Track completion status
   - Add new spiritual content

3. **Curriculum**
   - Organize content by age groups
   - Plan weekly spiritual lessons
   - Customize for different learning stages

4. **Planner**
   - Set spiritual goals and tasks
   - Track task completion
   - Schedule activities

5. **AI Assistant**
   - Get answers to spiritual questions
   - Access knowledge base content
   - Support for guided conversations

### For Children

1. **Browse Devotionals**
   - Read daily devotional content
   - Mark as complete when finished

2. **Track Progress**
   - See completion percentage
   - View completed vs. pending items

3. **Plan Tasks**
   - View assigned tasks
   - Update task status
   - Set personal goals

4. **Ask Questions**
   - Chat with AI assistant
   - Get spiritual guidance
   - Learn from knowledge base

## 📊 Database Models

### User
- id (Primary Key)
- name (String)

### Child
- id (Primary Key)
- name (String)

### Devotional
- id (Primary Key)
- title (String)
- content (Text)
- date (Date)
- created_at (DateTime)

### DevotionalProgress
- id (Primary Key)
- child_id (Foreign Key)
- devotional_id (Foreign Key)

### Curriculum
- id (Primary Key)
- title (String)
- description (Text)
- age_group (String)
- week (Integer)
- devotional_id (Foreign Key)
- created_at (DateTime)

### Planner
- id (Primary Key)
- child_id (Foreign Key)
- task_name (String)
- description (Text)
- date (String)
- status (String)

## 🤖 AI Chatbot Setup

### Adding Knowledge Base PDFs

1. Create a `documents/` folder in the backend directory
2. Add PDF files to this folder
3. The RAG system will automatically:
   - Extract text from PDFs
   - Create embeddings
   - Build searchable index

### Supported LLM Providers

- **OpenAI**: Set `OPENAI_API_KEY`
- **Groq**: Set `GROQ_API_KEY` (API key starting with `gsk_`)

## 🔐 Security Considerations

- Use environment variables for API keys
- Implement authentication/authorization
- Validate all user inputs
- Use HTTPS in production
- Implement CORS properly for frontend-backend communication

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🆘 Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Contact the development team
- Check existing documentation

## 🎉 Acknowledgments

- LangChain for RAG implementation
- Flask for backend framework
- All contributors and users

---

**Last Updated**: January 31, 2026



# 🟢 SSH LOGIN

```bash
ssh root@72.62.35.115
```

# 📁 PROJECT LOCATION

```bash
cd /var/www/GraceWise_AI
```

Backend:

```bash
cd /var/www/GraceWise_AI/backend
```

Frontend:

```bash
cd /var/www/GraceWise_AI/frontend
```

---

# 🐍 VENV ACTIVATE

Backend folder me:

```bash
cd /var/www/GraceWise_AI/backend
source venv/bin/activate
```

Deactivate:

```bash
deactivate
```

---

# 🔄 BACKEND RESTART (MOST USED)

```bash
systemctl restart gracewise
```

Status check:

```bash
systemctl status gracewise
```

Stop:

```bash
systemctl stop gracewise
```

Start:

```bash
systemctl start gracewise
```

---

# 📜 LIVE BACKEND LOGS

Live logs:

```bash
journalctl -u gracewise -f
```

Last 100 lines:

```bash
journalctl -u gracewise -n 100 --no-pager
```

Service status:

```bash
systemctl status gracewise --no-pager
```

---

# 🌐 NGINX CONTROL

Restart nginx:

```bash
systemctl restart nginx
```

Status:

```bash
systemctl status nginx
```

Test config:

```bash
nginx -t
```

---

# 📜 NGINX LOGS

Error log:

```bash
tail -f /var/log/nginx/error.log
```

Access log:

```bash
tail -f /var/log/nginx/access.log
```

---

# 🔍 CHECK PORT 5000 (backend running?)

```bash
lsof -i:5000
```

---

# 💀 KILL PORT (if stuck)

```bash
pkill -f gunicorn
pkill -f python
```

Then restart:

```bash
systemctl restart gracewise
```

---

# 🧪 DIRECT BACKEND TEST

```bash
curl http://127.0.0.1:5000
```

---

# 🔄 UPDATE CODE FROM GITHUB

```bash
cd /var/www/GraceWise_AI
git pull
```

Then restart:

```bash
systemctl restart gracewise
```

---

# 🛢 MYSQL LOGIN

```bash
mysql -u root -p
```

Show DB:

```sql
SHOW DATABASES;
```

Use DB:

```sql
USE gracewise;
```

Show tables:

```sql
SHOW TABLES;
```

Exit:

```sql
EXIT;
```

---

# ⚠️ FULL DEBUG COMMAND (SEND IF ERROR)

```bash
systemctl status gracewise --no-pager
journalctl -u gracewise -n 80 --no-pager
nginx -t
lsof -i:5000
```
hello