from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import csv
import re
from io import StringIO
from uuid import uuid4

# Ensure tracing is disabled
os.environ["LANGCHAIN_TRACING_V2"] = "false"

rag_bp = Blueprint('rag', __name__, url_prefix="/rag")
AI_PROMPT_KEY = "ai_assistant_system_prompt"
OPENAI_API_KEY_SETTING = "openai_api_key"
DEFAULT_AI_PROMPT = """You are GraceWise, a warm, friendly, faith-based Christian homeschool helper who responds in a natural, human-like way.

Purpose: Support and encourage homeschooling moms with spiritual guidance and practical academic help.

Guidelines:
- Be kind, simple, and faith-centered.
- Include Scripture or gentle encouragement when helpful.
- Give clear homeschooling advice (lessons, schedules, motivation).
- Respond warmly to greetings, thanks, or casual messages (e.g., hi, hello) with friendly, human conversation.
- Use provided context when relevant.
- Avoid negativity.
- End with an uplifting line like: "You're doing great - keep trusting God!"
"""
MANDATORY_CONTINUITY_RULES = """Conversation continuity rules:
- Always use prior turns from this same chat session as your primary conversation memory.
- Resolve follow-up references like "ye", "isko", "us table ko", "download link do" using the most recent relevant assistant output.
- If the user asks for a follow-up action (download/export/reformat/share), apply it to the last generated result unless they specify a different target.
- Ask a short clarification question only if more than one previous item could match the user's request.
"""

# Configure upload settings
UPLOAD_FOLDER = 'documents'
EXPORT_FOLDER = os.path.join(UPLOAD_FOLDER, 'exports')
ALLOWED_EXTENSIONS = {'pdf', 'txt'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Ensure documents folder exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(EXPORT_FOLDER):
    os.makedirs(EXPORT_FOLDER)

# Global variables for lazy initialization
vector_data = None
llm_cache = None


def get_user_id():
    user_id = get_jwt_identity()
    if isinstance(user_id, str):
        user_id = int(user_id)
    return user_id


def is_admin_user():
    from models import User

    user = User.query.get(get_user_id())
    return bool(user and user.is_admin)


def get_ai_system_prompt():
    from models import AppSetting

    setting = AppSetting.query.filter_by(setting_key=AI_PROMPT_KEY).first()
    base_prompt = DEFAULT_AI_PROMPT
    if setting and setting.setting_value and setting.setting_value.strip():
        base_prompt = setting.setting_value

    if MANDATORY_CONTINUITY_RULES.strip() in base_prompt:
        return base_prompt

    return f"{base_prompt.rstrip()}\n\n{MANDATORY_CONTINUITY_RULES}"


def get_openai_api_key():
    from models import AppSetting

    setting = AppSetting.query.filter_by(setting_key=OPENAI_API_KEY_SETTING).first()
    if setting and setting.setting_value and setting.setting_value.strip():
        return setting.setting_value.strip()
    return os.environ.get("OPENAI_API_KEY")


def allowed_file(filename):
    """Check if file is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def documents_exist():
    for root, dirs, files in os.walk(UPLOAD_FOLDER):
        for file in files:
            if file.lower().endswith(".pdf"):
                return True
    return False


def _trim_title(text, max_len=60):
    text = (text or "").strip()
    if not text:
        return "New chat"
    return text[:max_len].strip() + ("..." if len(text) > max_len else "")


def _build_langchain_history(history):
    from langchain_core.messages import HumanMessage, AIMessage

    messages = []
    for msg in history:
        role = msg.get("role")
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role in ("assistant", "ai"):
            messages.append(AIMessage(content=content))
    return messages


def _has_download_intent(text):
    text = (text or "").strip().lower()
    if not text:
        return False
    keywords = [
        "download", "downloadable", "export", "csv", "pdf", "file", "link",
        "isko", "iska", "uska", "is table", "that table", "this table",
    ]
    return any(k in text for k in keywords)


def _split_markdown_row(row):
    row = row.strip()
    if row.startswith("|"):
        row = row[1:]
    if row.endswith("|"):
        row = row[:-1]
    return [cell.strip() for cell in row.split("|")]


def _is_separator_row(row):
    cells = _split_markdown_row(row)
    if not cells:
        return False
    return all(re.fullmatch(r":?-{3,}:?", cell or "") for cell in cells)


def _extract_latest_markdown_table(history):
    """
    Find the latest assistant markdown table from conversation history.
    Returns table lines or None.
    """
    for msg in reversed(history or []):
        if msg.get("role") not in ("assistant", "ai"):
            continue
        content = (msg.get("content") or "").strip()
        if not content:
            continue

        lines = content.splitlines()
        block = []
        latest_valid = None
        for line in lines:
            stripped = line.strip()
            if "|" in stripped and stripped.startswith("|"):
                block.append(stripped)
                continue
            if len(block) >= 2 and _is_separator_row(block[1]):
                latest_valid = block[:]
            block = []

        if len(block) >= 2 and _is_separator_row(block[1]):
            latest_valid = block[:]

        if latest_valid:
            return latest_valid
    return None


def _table_lines_to_csv(table_lines):
    if not table_lines or len(table_lines) < 2:
        return None

    header = _split_markdown_row(table_lines[0])
    if not header:
        return None

    rows = []
    for row_line in table_lines[2:]:
        cells = _split_markdown_row(row_line)
        if not any(cells):
            continue
        if len(cells) < len(header):
            cells.extend([""] * (len(header) - len(cells)))
        elif len(cells) > len(header):
            cells = cells[:len(header)]
        rows.append(cells)

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    writer.writerows(rows)
    return output.getvalue()


def _save_export_csv(csv_text):
    if not csv_text:
        return None

    filename = f"chat-table-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:8]}.csv"
    file_path = os.path.join(EXPORT_FOLDER, filename)
    with open(file_path, "w", encoding="utf-8", newline="") as f:
        f.write(csv_text)
    return filename


def _build_export_links(filename):
    base = (request.headers.get("Origin") or request.url_root or "").rstrip("/")
    if not base:
        return {
            "api_link": f"/api/rag/exports/{filename}",
            "direct_link": f"/rag/exports/{filename}",
        }
    return {
        "api_link": f"{base}/api/rag/exports/{filename}",
        "direct_link": f"{base}/rag/exports/{filename}",
    }


def _try_auto_table_export(question, history):
    """
    If user asks for download/export and the latest assistant response contains a markdown table,
    auto-generate CSV and return answer payload.
    """
    if not _has_download_intent(question):
        return None

    table_lines = _extract_latest_markdown_table(history)
    if not table_lines:
        return None

    csv_text = _table_lines_to_csv(table_lines)
    filename = _save_export_csv(csv_text)
    if not filename:
        return None

    links = _build_export_links(filename)
    answer = (
        "I created a downloadable CSV from the table in our previous message.\n\n"
        f"- Primary link: {links['api_link']}\n"
        f"- Fallback link: {links['direct_link']}"
    )

    return {
        "answer": answer,
        "export_filename": filename,
        "download_url": links["api_link"],
        "download_url_fallback": links["direct_link"],
    }


def _prepare_chat_state(question, data, expected_chat_type=None, expected_lesson_id=None):
    """
    Prepare session/history for normal send and edited-message regeneration.
    Returns: (session, model_history, persist_state, error_dict_or_none)
    """
    from models import db, AiSession, AiChatMessage

    user_id = get_user_id()
    fallback_history = data.get("history", [])
    session_id = data.get("session_id")
    edit_message_id = data.get("edit_message_id")

    if not user_id or not session_id:
        return None, fallback_history, None, None

    try:
        session_id = int(session_id)
    except (TypeError, ValueError):
        return None, fallback_history, None, {"answer": "Invalid session_id."}

    session = AiSession.query.filter_by(id=session_id, user_id=user_id).first()
    if not session:
        return None, fallback_history, None, {"answer": "Session not found."}

    session_chat_type = (session.chat_type or "general").strip().lower()
    if expected_chat_type and session_chat_type != expected_chat_type:
        return None, fallback_history, None, {"answer": "Session type mismatch."}

    if expected_lesson_id is not None and session.lesson_id not in (None, expected_lesson_id):
        return None, fallback_history, None, {"answer": "Session lesson mismatch."}

    messages = (
        AiChatMessage.query
        .filter_by(session_id=session.id, user_id=user_id)
        .order_by(AiChatMessage.turn_index.asc(), AiChatMessage.id.asc())
        .all()
    )

    if edit_message_id is not None:
        try:
            edit_message_id = int(edit_message_id)
        except (TypeError, ValueError):
            return None, fallback_history, None, {"answer": "Invalid edit_message_id."}

        target = next((m for m in messages if m.id == edit_message_id and m.role == "user"), None)
        if not target:
            return None, fallback_history, None, {"answer": "Editable user message not found."}

        # Keep context only up to the edited turn (excluding the edited message itself).
        model_history = [{"role": m.role, "content": m.content} for m in messages if m.turn_index < target.turn_index]

        # Replace edited prompt and remove all following messages to regenerate from this point.
        target.content = question
        target.updated_at = datetime.utcnow()
        AiChatMessage.query.filter(
            AiChatMessage.session_id == session.id,
            AiChatMessage.user_id == user_id,
            AiChatMessage.turn_index > target.turn_index
        ).delete(synchronize_session=False)

        session.updated_at = datetime.utcnow()
        db.session.flush()

        persist_state = {
            "user_id": user_id,
            "session": session,
            "mode": "edit",
            "user_message": target,
            "assistant_turn_index": target.turn_index + 1,
        }
        return session, model_history, persist_state, None

    model_history = [{"role": m.role, "content": m.content} for m in messages]
    next_turn_index = (messages[-1].turn_index if messages else 0) + 1
    persist_state = {
        "user_id": user_id,
        "session": session,
        "mode": "new",
        "user_turn_index": next_turn_index,
    }
    return session, model_history, persist_state, None


def _persist_chat_exchange(persist_state, question, answer):
    from models import db, AiChatMessage

    if not persist_state:
        return {}

    session = persist_state["session"]
    user_id = persist_state["user_id"]

    if persist_state["mode"] == "edit":
        user_message = persist_state["user_message"]
        assistant_message = AiChatMessage(
            session_id=session.id,
            user_id=user_id,
            role="assistant",
            content=answer,
            turn_index=persist_state["assistant_turn_index"],
        )
        db.session.add(assistant_message)
    else:
        user_message = AiChatMessage(
            session_id=session.id,
            user_id=user_id,
            role="user",
            content=question,
            turn_index=persist_state["user_turn_index"],
        )
        assistant_message = AiChatMessage(
            session_id=session.id,
            user_id=user_id,
            role="assistant",
            content=answer,
            turn_index=persist_state["user_turn_index"] + 1,
        )
        db.session.add(user_message)
        db.session.add(assistant_message)

    if not (session.title or "").strip():
        session.title = _trim_title(question)
    session.updated_at = datetime.utcnow()
    db.session.commit()

    return {
        "session_id": session.id,
        "user_message_id": user_message.id,
        "assistant_message_id": assistant_message.id,
    }


# ==================== HEALTH CHECK ====================
@rag_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    try:
        has_groq = bool(os.environ.get("GROQ_API_KEY"))
        has_openai = bool(get_openai_api_key())
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


@rag_bp.route("/admin/prompt", methods=["GET"])
@jwt_required()
def get_admin_prompt():
    if not is_admin_user():
        return jsonify({"message": "Admin access required"}), 403

    return jsonify({
        "setting_key": AI_PROMPT_KEY,
        "prompt": get_ai_system_prompt()
    }), 200


@rag_bp.route("/admin/prompt", methods=["PUT"])
@jwt_required()
def update_admin_prompt():
    if not is_admin_user():
        return jsonify({"message": "Admin access required"}), 403

    data = request.json or {}
    prompt = (data.get("prompt") or "").strip()

    if not prompt:
        return jsonify({"message": "Prompt cannot be empty"}), 400

    if len(prompt) > 12000:
        return jsonify({"message": "Prompt is too long (max 12000 chars)"}), 400

    from models import db, AppSetting

    setting = AppSetting.query.filter_by(setting_key=AI_PROMPT_KEY).first()
    if not setting:
        setting = AppSetting(setting_key=AI_PROMPT_KEY, setting_value=prompt)
        db.session.add(setting)
    else:
        setting.setting_value = prompt

    db.session.commit()

    return jsonify({
        "message": "AI prompt updated successfully",
        "prompt": setting.setting_value
    }), 200


@rag_bp.route("/admin/openai-key", methods=["GET"])
@jwt_required()
def get_admin_openai_key_status():
    if not is_admin_user():
        return jsonify({"message": "Admin access required"}), 403

    from models import AppSetting

    openai_key = get_openai_api_key()
    has_db_setting = AppSetting.query.filter_by(setting_key=OPENAI_API_KEY_SETTING).first() is not None
    return jsonify({
        "setting_key": OPENAI_API_KEY_SETTING,
        "configured": bool(openai_key and openai_key.strip()),
        "api_key": openai_key or "",
        "source": "database" if has_db_setting else "env"
    }), 200


@rag_bp.route("/admin/openai-key", methods=["PUT"])
@jwt_required()
def update_admin_openai_key():
    if not is_admin_user():
        return jsonify({"message": "Admin access required"}), 403

    data = request.json or {}
    api_key = (data.get("api_key") or "").strip()

    if not api_key:
        return jsonify({"message": "OpenAI API key cannot be empty"}), 400

    if len(api_key) < 20:
        return jsonify({"message": "OpenAI API key looks invalid"}), 400

    from models import db, AppSetting

    all_settings = AppSetting.query.filter_by(setting_key=OPENAI_API_KEY_SETTING).order_by(AppSetting.id.asc()).all()
    setting = all_settings[0] if all_settings else None
    if not setting:
        setting = AppSetting(setting_key=OPENAI_API_KEY_SETTING, setting_value=api_key)
        db.session.add(setting)
    else:
        setting.setting_value = api_key
        for duplicate in all_settings[1:]:
            db.session.delete(duplicate)

    db.session.commit()

    global llm_cache
    llm_cache = None

    return jsonify({
        "message": "OpenAI API key updated successfully",
        "configured": True
    }), 200


@rag_bp.route("/admin/openai-key/test", methods=["POST"])
@jwt_required()
def test_admin_openai_key():
    if not is_admin_user():
        return jsonify({"message": "Admin access required"}), 403

    data = request.json or {}
    api_key = (data.get("api_key") or "").strip() or (get_openai_api_key() or "").strip()

    if not api_key:
        return jsonify({"message": "OpenAI API key is not configured"}), 400

    if len(api_key) < 20:
        return jsonify({"message": "OpenAI API key looks invalid"}), 400

    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage
    except ImportError:
        return jsonify({"message": "Server is missing OpenAI dependencies"}), 500

    try:
        llm = ChatOpenAI(
            openai_api_key=api_key,
            model="gpt-4.1",
            temperature=0,
            timeout=20,
            max_retries=1,
        )
        response = llm.invoke([
            SystemMessage(content="You are a connectivity test assistant. Reply in one short line."),
            HumanMessage(content="Reply with: OpenAI key is working.")
        ])
        reply = (response.content or "").strip()
        return jsonify({
            "working": True,
            "message": "OpenAI API key is working",
            "reply_preview": reply[:200]
        }), 200
    except Exception as e:
        return jsonify({
            "working": False,
            "message": "OpenAI API key test failed",
            "error": str(e)
        }), 400


def get_llm():
    global llm_cache
    if llm_cache is not None:
        return llm_cache
    
    groq_key = os.environ.get("GROQ_API_KEY")
    openai_key = get_openai_api_key()
    
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
            # model="openai/gpt-oss-120b",
            model="gpt-4.1",
            # base_url="https://api.canopywave.io/v1",
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
@jwt_required(optional=True)
def ask():
    data = request.json or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"answer": "Please provide a question."}), 400

    persist_state = None
    try:
        _, conversation_history, persist_state, state_error = _prepare_chat_state(
            question=question,
            data=data,
            expected_chat_type="general"
        )
        if state_error:
            return jsonify(state_error), 400

        auto_export = _try_auto_table_export(question, conversation_history)
        if auto_export:
            ids = _persist_chat_exchange(persist_state, question, auto_export["answer"])
            return jsonify({**auto_export, "sources_count": 0, **ids}), 200

        from langchain_core.messages import SystemMessage, HumanMessage

        if not documents_exist():
            llm = get_llm()
            if llm == "ERROR_NO_KEY":
                return jsonify({"answer": "API key is missing. Please add a valid GROQ_API_KEY or OPENAI_API_KEY and restart backend."}), 500
            if llm == "ERROR_IMPORT":
                return jsonify({"answer": "Server is missing required LLM dependencies."}), 500

            messages = [SystemMessage(content=get_ai_system_prompt())]
            messages.extend(_build_langchain_history(conversation_history))
            messages.append(HumanMessage(content=question))

            response = llm.invoke(messages)
            answer = response.content
            ids = _persist_chat_exchange(persist_state, question, answer)
            return jsonify({"answer": answer, "sources_count": 0, **ids}), 200

        result = get_qa_chain()
        if result == "ERROR_NO_KEY":
            return jsonify({"answer": "API key is missing. Please add a valid GROQ_API_KEY or OPENAI_API_KEY and restart backend."}), 500
        if result == "ERROR_IMPORT":
            return jsonify({"answer": "Server is missing required RAG dependencies."}), 500
        if result is None:
            return jsonify({"answer": "No documents found. Please add PDFs to 'documents' folder and restart server."}), 404

        chunks, chunk_embeddings, llm, embed_model, _ = result

        import numpy as np
        query_emb = embed_model.encode([question])[0]
        similarities = [np.dot(query_emb, ce) / (np.linalg.norm(query_emb) * np.linalg.norm(ce)) for ce in chunk_embeddings]
        top_idx = np.argsort(similarities)[-3:][::-1]
        context = "\n\n".join([chunks[i] for i in top_idx])

        dynamic_prompt_with_context = (
            get_ai_system_prompt()
            + "\n\nAnswer based on the context provided below. If the answer is not in the context, "
            + "provide helpful Christian homeschooling guidance based on your knowledge."
        )

        messages = [SystemMessage(content=dynamic_prompt_with_context)]
        messages.extend(_build_langchain_history(conversation_history))
        messages.append(HumanMessage(content=f"Context:\n{context}\n\nQuestion: {question}"))

        response = llm.invoke(messages)
        answer = response.content
        ids = _persist_chat_exchange(persist_state, question, answer)
        return jsonify({"answer": answer, "sources_count": 3, **ids}), 200

    except Exception as e:
        from models import db
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"answer": f"Error: {str(e)}"}), 500


# ==================== UPLOAD PDF ====================
@rag_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_document():
    """Upload PDF document for RAG system"""
    try:
        if not is_admin_user():
            return jsonify({"message": "Admin access required"}), 403

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
@jwt_required()
def list_documents():
    """List all uploaded PDF documents"""
    try:
        if not is_admin_user():
            return jsonify({"message": "Admin access required"}), 403

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
@jwt_required()
def delete_document(filename):
    """Delete an uploaded PDF document"""
    try:
        if not is_admin_user():
            return jsonify({"message": "Admin access required"}), 403

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
@jwt_required()
def rag_status():
    """Get RAG system status"""
    try:
        if not is_admin_user():
            return jsonify({"message": "Admin access required"}), 403

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
    """Ask a question about a specific lesson and persist chat history."""
    data = request.json or {}
    question = (data.get("question") or "").strip()

    if not question:
        return jsonify({"answer": "Please provide a question."}), 400

    persist_state = None
    try:
        _, conversation_history, persist_state, state_error = _prepare_chat_state(
            question=question,
            data=data,
            expected_chat_type="lesson",
            expected_lesson_id=lesson_id,
        )
        if state_error and data.get("session_id") is not None:
            return jsonify(state_error), 400

        auto_export = _try_auto_table_export(question, conversation_history)
        if auto_export:
            ids = _persist_chat_exchange(persist_state, question, auto_export["answer"])
            return jsonify({
                **auto_export,
                "lesson_name": None,
                "sources_count": 0,
                "search_queries": [],
                **ids,
            }), 200

        lesson_data = _load_lesson_data(lesson_id)
        if lesson_data is None:
            return jsonify({"answer": "Lesson file not found or unreadable."}), 404

        lesson = lesson_data["lesson"]

        llm = get_llm()
        if llm == "ERROR_NO_KEY":
            return jsonify({"answer": "API key is missing."}), 500
        if llm == "ERROR_IMPORT":
            return jsonify({"answer": "Server is missing required LLM dependencies."}), 500

        from langchain_core.messages import SystemMessage, HumanMessage

        search_planning_prompt = f"""You are an AI tutor helping a student with the lesson: \"{lesson.name}\".

Given the student's question, generate 1-3 short search queries that would help find the most relevant information from the lesson document. Return ONLY the search queries, one per line, nothing else.

Student's question: {question}"""

        search_response = llm.invoke([
            SystemMessage(content="You generate search queries to retrieve information from a document. Return only the queries, one per line."),
            HumanMessage(content=search_planning_prompt),
        ])

        search_queries = [q.strip() for q in search_response.content.strip().split("\n") if q.strip()]
        if not search_queries:
            search_queries = [question]

        all_retrieved = []
        seen_indices = set()
        for query in search_queries[:3]:
            results = _retrieve_from_lesson(query, lesson_data, top_k=3)
            for item in results:
                if item["chunk_index"] not in seen_indices:
                    seen_indices.add(item["chunk_index"])
                    all_retrieved.append(item)

        all_retrieved.sort(key=lambda x: x["score"], reverse=True)
        top_chunks = all_retrieved[:5]

        retrieved_context = "\n\n---\n\n".join([
            f"[Section {r['chunk_index'] + 1}] (relevance: {r['score']})\n{r['text']}"
            for r in top_chunks
        ])

        system_prompt = f"""You are a friendly and knowledgeable AI tutor helping a student learn from the lesson: \"{lesson.name}\".

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
        messages.extend(_build_langchain_history(conversation_history))
        messages.append(HumanMessage(content=question))

        response = llm.invoke(messages)
        answer = response.content
        ids = _persist_chat_exchange(persist_state, question, answer)

        return jsonify({
            "answer": answer,
            "lesson_name": lesson.name,
            "sources_count": len(top_chunks),
            "search_queries": search_queries,
            **ids,
        }), 200

    except Exception as e:
        from models import db
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"answer": f"Error: {str(e)}"}), 500


@rag_bp.route("/exports/<filename>", methods=["GET"])
def download_export(filename):
    safe_name = secure_filename(filename)
    if not safe_name:
        return jsonify({"message": "Invalid filename"}), 400

    file_path = os.path.join(EXPORT_FOLDER, safe_name)
    if not os.path.exists(file_path):
        return jsonify({"message": "File not found"}), 404

    return send_from_directory(EXPORT_FOLDER, safe_name, as_attachment=True)
