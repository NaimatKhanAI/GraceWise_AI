# Gracewise System 2: Backend Documentation & System Architecture

This document provides a comprehensive overview of the **Gracewise System 2** backend. It is designed to help both clients and developers understand how the system operates, how data flows, and how the various components interact.

---

## 1. System Overview
Gracewise System 2 is a Flask-based backend application designed to manage educational content, child progress, and parent-child interactions through a structured curriculum. It also features an advanced **AI RAG (Retrieval-Augmented Generation) Chatbot** that allows users to query internal documents (PDFs) intelligently.

## 2. Technology Stack
*   **Language**: Python 3.14+
*   **Framework**: Flask (Web Framework)
*   **Database**: MySQL (Primary storage for users, children, and progress)
*   **Vector Database**: ChromaDB (Stores document embeddings for the AI Chatbot)
*   **Machine Learning**: 
    *   **Sentence Transformers**: Local embedding model (`all-MiniLM-L6-v2`) for cost-effective text vectorization.
    *   **Groq / OpenAI**: Powering the Large Language Model (LLM) for intelligent responses.
*   **ORM**: Flask-SQLAlchemy (Database management)

---

## 3. Core Modules & Features

### A. Dashboard Management
*   **Purpose**: Provides high-level statistics for the user.
*   **Endpoints**: `/dashboard/summary`
*   **Flow**: Queries the MySQL database to count total users, children, active planners, and completed devotionals to provide a "Status at a Glance."

### B. Devotional & Progress Tracking
*   **Purpose**: Manages daily "devotionals" (content for kids) and tracks completion.
*   **Endpoints**: `/devotionals/`
*   **Flow**: Parents can browse, create, update, or delete devotionals. When a child completes a devotional, the system creates a record in the `DevotionalProgress` table, linking the user/child to that specific content.

### C. Child Progress & Planner
*   **Purpose**: Visualizes a child's journey and manages their tasks.
*   **Endpoints**: `/child_progress/`, `/planner/`
*   **Flow**: 
    1.  **Planner**: Allows scheduling tasks (Pending/Completed).
    2.  **Progress**: Calculates completion percentages based on the number of devotionals finished versus the total available.

### D. Curriculum Management
*   **Purpose**: Structures devotionals into weeks or age-specific groups.
*   **Endpoints**: `/curriculum/`
*   **Flow**: Organizes content horizontally (across age groups) and vertically (across weeks), creating a guided learning path for the family.

---

## 4. The RAG Chatbot Flow (AI System)
This is the most advanced part of the system. It uses **RAG (Retrieval-Augmented Generation)** to answer questions based on your specific PDF documents.

### How it works:
1.  **Document Ingestion**:
    *   PDF files are placed in the `/documents` folder.
    *   The system reads the text from these PDFs using `PdfReader`.
2.  **Chunking & Embedding**:
    *   Long text is broken down into smaller, searchable "chunks" (1000 characters each).
    *   Each chunk is converted into a mathematical vector (Embedding) using a **local AI model**. This is fast and 100% free.
3.  **Vector Storage (ChromaDB)**:
    *   These vectors and the original text are stored in **ChromaDB**. This acts like a "Brain" that can find text by its meaning, not just keywords.
4.  **The Query Process**:
    *   When a user asks a question, the question is also converted into a vector.
    *   The system searches ChromaDB for the top 3 most relevant text chunks (Context).
5.  **LLM Generation**:
    *   The question + the retrieved context are sent to the LLM (Groq/Llama-3.3 or OpenAI).
    *   The AI provides a natural language answer based **only** on your documents.

---

## 5. Security & Environment
*   **.env Configuration**: Sensitive data like database URLs and API keys are stored in a hidden `.env` file.
*   **Error Handling**: The system includes tracebacks and explicit error messages (e.g., "API Key missing") to ensure easy troubleshooting.

---

## 10. How the System Works (Summary for Clients)
The Gracewise System acts as a central hub. It takes information about children and tasks, stores them securely in a database, and uses AI to make that information searchable. Whether you are tracking a child's progress or asking the AI about a specific lesson plan, the backend ensures the data is processed accurately, securely, and cost-effectively.
