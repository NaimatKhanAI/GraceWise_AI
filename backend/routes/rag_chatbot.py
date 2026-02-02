from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import os
from datetime import datetime

# Ensure tracing is disabled
os.environ["LANGCHAIN_TRACING_V2"] = "false"

rag_bp = Blueprint('rag', __name__, url_prefix="/rag")

# Configure upload settings
UPLOAD_FOLDER = 'documents'
ALLOWED_EXTENSIONS = {'pdf'}
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
    if not os.path.exists(UPLOAD_FOLDER):
        return False
    return any(name.endswith('.pdf') for name in os.listdir(UPLOAD_FOLDER))


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
    files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]
    if not files:
        print("No PDF files found.")
        return None

    for file_name in files:
        print(f"Processing {file_name}...")
        try:
            reader = PdfReader(os.path.join(PDF_DIR, file_name))
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    all_text += text + "\n"
        except Exception as e:
            print(f"Error reading {file_name}: {e}")

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
        for filename in os.listdir(UPLOAD_FOLDER):
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
            for filename in os.listdir(UPLOAD_FOLDER):
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

