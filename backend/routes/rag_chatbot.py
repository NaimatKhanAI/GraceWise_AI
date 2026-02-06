from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from datetime import datetime

# Ensure tracing is disabled
os.environ["LANGCHAIN_TRACING_V2"] = "false"

rag_bp = Blueprint('rag', __name__, url_prefix="/rag")

# Configure upload settings
UPLOAD_FOLDER = 'documents'
ALLOWED_EXTENSIONS = {'pdf', 'txt'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Ensure documents folder exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Global variables for lazy initialization
vector_data = None
llm_cache = None


def allowed_file(filename):
    """Check if file is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def documents_exist():
    for root, dirs, files in os.walk(UPLOAD_FOLDER):
        for file in files:
            if file.lower().endswith(".pdf"):
                return True
    return False


# ==================== HEALTH CHECK ====================
@rag_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    try:
        has_groq = bool(os.environ.get("GROQ_API_KEY"))
        has_openai = bool(os.environ.get("OPENAI_API_KEY"))
        has_docs = documents_exist()
        
        return jsonify({
            "status": "healthy",
            "groq_configured": has_groq,
            "openai_configured": has_openai,
            "documents_available": has_docs,
            "rag_initialized": vector_data is not None,
            "llm_cached": llm_cache is not None
        }), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500


def get_llm():
    global llm_cache
    if llm_cache is not None:
        return llm_cache
    
    groq_key = os.environ.get("GROQ_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    
    # Check for placeholder values
    if groq_key and "your_" in groq_key:
        groq_key = None
    if openai_key and "your_" in openai_key:
        openai_key = None
    
    if not groq_key and not openai_key:
        print("ERROR: Valid API Key is missing. Please add GROQ_API_KEY or OPENAI_API_KEY to .env file.")
        return "ERROR_NO_KEY"

    try:
        from langchain_openai import ChatOpenAI
        from langchain_groq import ChatGroq
    except ImportError as e:
        print(f"Import error: {e}")
        return "ERROR_IMPORT"

    if groq_key:
        print("Using Groq LLM")
        llm_cache = ChatGroq(
            groq_api_key=groq_key,
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            timeout=60,
        )
    else:
        print("Using OpenAI LLM")
        llm_cache = ChatOpenAI(
            openai_api_key=openai_key,
            model="openai/gpt-oss-120b",
            base_url="https://api.canopywave.io/v1",
            temperature=0.2,
            timeout=30,
            max_retries=2
        )
    
    return llm_cache


def get_qa_chain():
    global vector_data
    if vector_data is not None:
        return vector_data

    if not documents_exist():
        print("No PDF files found. Skipping RAG initialization.")
        return None

    print("\n--- Initializing RAG System ---")
    llm = get_llm()
    if llm in ("ERROR_NO_KEY", "ERROR_IMPORT"):
        return llm

    # Heavy imports inside function to avoid startup crashes
    try:
        from pypdf import PdfReader
        import numpy as np
        from sentence_transformers import SentenceTransformer
    except ImportError as e:
        print(f"Import error: {e}")
        return "ERROR_IMPORT"

    # ======== Load PDFs manually ========
    PDF_DIR = UPLOAD_FOLDER
    if not os.path.exists(PDF_DIR):
        os.makedirs(PDF_DIR)
        
    all_text = ""
    print(f"Loading PDFs from {PDF_DIR}...")
 
    files = []
    for root, dirs, filenames in os.walk(PDF_DIR):
        for name in filenames:
            if name.lower().endswith(".pdf"):
                files.append(os.path.join(root, name))
    

    if not files:
        print("No PDF files found.")
        return None

    # for file_name in files:
    #     print(f"Processing {file_name}...")
    #     try:
    #         reader = PdfReader(os.path.join(PDF_DIR, file_name))
    #         for page in reader.pages:
    #             text = page.extract_text()
    #             if text:
    #                 all_text += text + "\n"
    #     except Exception as e:
    #         print(f"Error reading {file_name}: {e}")

    for file_path in files:
        print(f"Processing {file_path}...")
        try:
            reader = PdfReader(file_path)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    all_text += text + "\n"
        except Exception as e:
            print(f"Error reading {file_path}: {e}")


    if not all_text.strip():
        print("No text extracted from PDFs.")
        return None

    print(f"Splitting text into chunks (Total length: {len(all_text)})...")
    chunks = [all_text[i:i+1000] for i in range(0, len(all_text), 850)]

    print(f"Generating embeddings for {len(chunks)} chunks via Local Model (SentenceTransformer)...")
    embed_model = SentenceTransformer('all-MiniLM-L6-v2')
    chunk_embeddings = embed_model.encode(chunks)

    print("RAG System Initialized.")
    vector_data = (chunks, chunk_embeddings, llm, embed_model, bool(os.environ.get("GROQ_API_KEY")))
    return vector_data

# ==================== ASK QUESTION ====================
@rag_bp.route("/ask", methods=["POST"])
def ask():
    data = request.json
    question = data.get("question")
    if not question:
        return jsonify({"answer": "Please provide a question."}), 400

    try:
        if not documents_exist():
            print(f"No documents, using direct LLM for: {question}")
            llm = get_llm()
            if llm == "ERROR_NO_KEY":
                return jsonify({"answer": "❌ API Key is missing. Please add a valid GROQ_API_KEY or OPENAI_API_KEY to the backend/.env file and restart the server."}), 500
            if llm == "ERROR_IMPORT":
                return jsonify({"answer": "Server is missing required LLM dependencies."}), 500

            from langchain_core.messages import SystemMessage, HumanMessage
            
            print("Invoking LLM...")
            try:
                response = llm.invoke([
                    SystemMessage(content="You are a helpful assistant."),
                    HumanMessage(content=question)
                ])
                print(f"LLM response received: {len(response.content)} chars")
                return jsonify({"answer": response.content, "sources_count": 0}), 200
            except Exception as llm_error:
                print(f"LLM invocation error: {llm_error}")
                return jsonify({"answer": f"❌ Error calling LLM: {str(llm_error)}"}), 500

        result = get_qa_chain()
        if result == "ERROR_NO_KEY":
            return jsonify({"answer": "❌ API Key is missing. Please add a valid GROQ_API_KEY or OPENAI_API_KEY to the backend/.env file and restart the server."}), 500
        if result == "ERROR_IMPORT":
            return jsonify({"answer": "Server is missing required RAG dependencies."}), 500
        if result is None:
            return jsonify({"answer": "No documents found. Please add PDFs to 'documents' folder and restart server."}), 404
        
        chunks, chunk_embeddings, llm, embed_model, is_groq = result
        print(f"Querying: {question}")
        
        # Get query embedding locally
        import numpy as np
        query_emb = embed_model.encode([question])[0]
        
        # Simple Cosine Similarity
        similarities = [np.dot(query_emb, ce) / (np.linalg.norm(query_emb) * np.linalg.norm(ce)) for ce in chunk_embeddings]
        top_idx = np.argsort(similarities)[-3:][::-1]
        context = "\n\n".join([chunks[i] for i in top_idx])
        
        # Call LLM using LangChain
        from langchain_core.messages import SystemMessage, HumanMessage

        response = llm.invoke([
            SystemMessage(content="Answer based on context provided. If not in context, say so."),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion: {question}")
        ])

        return jsonify({"answer": response.content, "sources_count": 3}), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"answer": f"Error: {str(e)}"}), 500


# ==================== UPLOAD PDF ====================
@rag_bp.route("/upload", methods=["POST"])
def upload_document():
    """Upload PDF document for RAG system"""
    try:
        if 'file' not in request.files:
            return jsonify({"message": "No file provided"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"message": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"message": "Only PDF files are allowed"}), 400
        
        file_data = file.read()
        if len(file_data) > MAX_FILE_SIZE:
            return jsonify({"message": "File size exceeds 50MB limit"}), 413
        
        # Secure filename and save
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_")
        filename = timestamp + filename
        
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        with open(filepath, 'wb') as f:
            f.write(file_data)
        
        # Reset RAG system to reload documents
        global vector_data
        vector_data = None
        
        return jsonify({
            "message": "File uploaded successfully!",
            "filename": filename,
            "size": len(file_data)
        }), 201
    
    except Exception as e:
        return jsonify({"message": f"Upload error: {str(e)}"}), 500


# ==================== LIST DOCUMENTS ====================
@rag_bp.route("/documents", methods=["GET"])
def list_documents():
    """List all uploaded PDF documents"""
    try:
        if not os.path.exists(UPLOAD_FOLDER):
            return jsonify({"documents": [], "count": 0}), 200
        
        documents = []
        for root, dirs, filenames in os.walk(UPLOAD_FOLDER):
            for filename in filenames:
                if filename.endswith(".pdf"):
                    filepath = os.path.join(root, filename)

            if filename.endswith('.pdf'):
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                size = os.path.getsize(filepath)
                modified_time = os.path.getmtime(filepath)
                
                documents.append({
                    "filename": filename,
                    "size": size,
                    "size_mb": round(size / (1024 * 1024), 2),
                    "uploaded_at": datetime.fromtimestamp(modified_time).isoformat()
                })
        
        # Sort by upload time (newest first)
        documents.sort(key=lambda x: x['uploaded_at'], reverse=True)
        
        return jsonify({
            "documents": documents,
            "count": len(documents)
        }), 200
    
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== DELETE DOCUMENT ====================
@rag_bp.route("/documents/<filename>", methods=["DELETE"])
def delete_document(filename):
    """Delete an uploaded PDF document"""
    try:
        # Prevent directory traversal attacks
        if '/' in filename or '\\' in filename or filename.startswith('.'):
            return jsonify({"message": "Invalid filename"}), 400
        
        filepath = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        
        if not os.path.exists(filepath):
            return jsonify({"message": "File not found"}), 404
        
        if not filepath.endswith('.pdf'):
            return jsonify({"message": "Only PDF files can be deleted"}), 400
        
        os.remove(filepath)
        
        # Reset RAG system
        global vector_data
        vector_data = None
        
        return jsonify({"message": "Document deleted successfully!"}), 200
    
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== GET RAG STATUS ====================
@rag_bp.route("/status", methods=["GET"])
def rag_status():
    """Get RAG system status"""
    try:
        doc_count = 0
        total_size = 0
        
        if os.path.exists(UPLOAD_FOLDER):
            for root, dirs, filenames in os.walk(UPLOAD_FOLDER):
                for filename in filenames:
                    if filename.endswith(".pdf"):
                        filepath = os.path.join(root, filename)

                if filename.endswith('.pdf'):
                    doc_count += 1
                    filepath = os.path.join(UPLOAD_FOLDER, filename)
                    total_size += os.path.getsize(filepath)
        
        is_initialized = vector_data is not None
        
        return jsonify({
            "initialized": is_initialized,
            "documents_count": doc_count,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "documents_folder": UPLOAD_FOLDER
        }), 200
    
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== CREATE DOCUMENT EMBEDDINGS ====================
def create_document_embeddings(filepath):
    """Create embeddings for a newly uploaded document"""
    global vector_data
    
    try:
        print(f"Creating embeddings for: {filepath}")
        
        # Reset vector_data to force re-initialization with new document
        vector_data = None
        
        # Trigger re-initialization
        get_qa_chain()
        
        print(f"Embeddings created successfully for: {filepath}")
        return True
    
    except Exception as e:
        print(f"Error creating embeddings: {e}")
        return False


# ==================== ASK LESSON-SPECIFIC QUESTION (LLM WITH RETRIEVAL TOOL) ====================

# Cache for lesson embeddings to avoid re-processing on every question
_lesson_cache = {}

def _load_lesson_data(lesson_id):
    """Load and cache lesson text + embeddings"""
    if lesson_id in _lesson_cache:
        return _lesson_cache[lesson_id]
    
    from models import Lesson
    lesson = Lesson.query.get_or_404(lesson_id)
    lesson_file_path = os.path.join(UPLOAD_FOLDER, lesson.file_path)
    
    if not os.path.exists(lesson_file_path):
        return None
    
    text_content = ""
    
    if lesson.file_type == 'pdf':
        from pypdf import PdfReader
        reader = PdfReader(lesson_file_path)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_content += page_text + "\n"
    elif lesson.file_type == 'txt':
        with open(lesson_file_path, 'r', encoding='utf-8') as f:
            text_content = f.read()
    
    if not text_content.strip():
        return None
    
    # Chunk the text
    chunk_size = 1000
    overlap = 150
    chunks = []
    for i in range(0, len(text_content), chunk_size - overlap):
        chunks.append(text_content[i:i + chunk_size])
    
    # Generate embeddings
    from sentence_transformers import SentenceTransformer
    embed_model = SentenceTransformer('all-MiniLM-L6-v2')
    chunk_embeddings = embed_model.encode(chunks)
    
    _lesson_cache[lesson_id] = {
        "lesson": lesson,
        "chunks": chunks,
        "embeddings": chunk_embeddings,
        "embed_model": embed_model,
        "full_text": text_content
    }
    return _lesson_cache[lesson_id]


def _retrieve_from_lesson(query, lesson_data, top_k=5):
    """Retrieval tool: search lesson chunks by semantic similarity"""
    import numpy as np
    
    chunks = lesson_data["chunks"]
    chunk_embeddings = lesson_data["embeddings"]
    embed_model = lesson_data["embed_model"]
    
    query_emb = embed_model.encode([query])[0]
    similarities = [
        float(np.dot(query_emb, ce) / (np.linalg.norm(query_emb) * np.linalg.norm(ce)))
        for ce in chunk_embeddings
    ]
    top_idx = sorted(range(len(similarities)), key=lambda i: similarities[i], reverse=True)[:top_k]
    
    results = []
    for i in top_idx:
        results.append({"chunk_index": i, "score": round(similarities[i], 4), "text": chunks[i]})
    return results


@rag_bp.route("/ask-lesson/<int:lesson_id>", methods=["POST"])
@jwt_required()
def ask_lesson(lesson_id):
    """Ask a question about a specific lesson — LLM uses retrieval as a tool"""
    from models import Lesson
    
    data = request.json
    question = data.get("question")
    conversation_history = data.get("history", [])  # [{role, content}, ...]
    
    if not question:
        return jsonify({"answer": "Please provide a question."}), 400

    try:
        # Load lesson data (cached)
        lesson_data = _load_lesson_data(lesson_id)
        if lesson_data is None:
            return jsonify({"answer": "❌ Lesson file not found or unreadable."}), 404
        
        lesson = lesson_data["lesson"]
        
        # Get LLM
        llm = get_llm()
        if llm == "ERROR_NO_KEY":
            return jsonify({"answer": "❌ API Key is missing."}), 500
        if llm == "ERROR_IMPORT":
            return jsonify({"answer": "Server is missing required LLM dependencies."}), 500

        # Step 1: LLM decides what to search for (tool use pattern)
        from langchain_core.messages import SystemMessage, HumanMessage
        
        # Generate search queries from the LLM
        search_planning_prompt = f"""You are an AI tutor helping a student with the lesson: "{lesson.name}".

Given the student's question, generate 1-3 short search queries that would help find the most relevant information from the lesson document. Return ONLY the search queries, one per line, nothing else.

Student's question: {question}"""

        search_response = llm.invoke([
            SystemMessage(content="You generate search queries to retrieve information from a document. Return only the queries, one per line."),
            HumanMessage(content=search_planning_prompt)
        ])
        
        search_queries = [q.strip() for q in search_response.content.strip().split('\n') if q.strip()]
        if not search_queries:
            search_queries = [question]
        
        print(f"[Lesson {lesson_id}] Search queries: {search_queries}")
        
        # Step 2: Execute retrieval for each query
        all_retrieved = []
        seen_indices = set()
        for query in search_queries[:3]:  # max 3 queries
            results = _retrieve_from_lesson(query, lesson_data, top_k=3)
            for r in results:
                if r["chunk_index"] not in seen_indices:
                    seen_indices.add(r["chunk_index"])
                    all_retrieved.append(r)
        
        # Sort by score and take top 5
        all_retrieved.sort(key=lambda x: x["score"], reverse=True)
        top_chunks = all_retrieved[:5]
        
        retrieved_context = "\n\n---\n\n".join([f"[Section {r['chunk_index']+1}] (relevance: {r['score']})\n{r['text']}" for r in top_chunks])
        
        print(f"[Lesson {lesson_id}] Retrieved {len(top_chunks)} chunks, scores: {[r['score'] for r in top_chunks]}")
        
        # Step 3: Build conversation with retrieved context and history
        system_prompt = f"""You are a friendly and knowledgeable AI tutor helping a student learn from the lesson: "{lesson.name}".

Your role:
- Help the student understand the lesson content deeply
- Answer questions with clear, educational explanations
- Use examples and analogies when helpful
- Encourage the student and praise good questions
- If the student asks something not covered in the lesson, be honest about it and explain what the lesson does cover
- Reference specific parts of the lesson when answering
- Keep answers focused and structured (use bullet points, headers, etc.)

Below are the most relevant sections retrieved from the lesson document:

{retrieved_context}

Use these sections to answer the student's question accurately. You may also draw on your general knowledge to supplement explanations, but always ground your answers in the lesson content first."""

        messages = [SystemMessage(content=system_prompt)]
        
        # Add conversation history (max last 10 exchanges)
        for msg in conversation_history[-20:]:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg.get("role") == "assistant":
                from langchain_core.messages import AIMessage
                messages.append(AIMessage(content=msg["content"]))
        
        # Add current question
        messages.append(HumanMessage(content=question))
        
        # Step 4: Get LLM answer
        response = llm.invoke(messages)

        return jsonify({
            "answer": response.content,
            "lesson_name": lesson.name,
            "sources_count": len(top_chunks),
            "search_queries": search_queries
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"answer": f"❌ Error: {str(e)}"}), 500
