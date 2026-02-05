from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from models import db, Quiz, QuizResult, User, Notification
import os
import json
from datetime import datetime
try:
    from PyPDF2 import PdfReader
except ImportError:
    PdfReader = None

quiz_bp = Blueprint("quiz", __name__)

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx', 'md'}
UPLOAD_FOLDER = 'documents'

def get_user_id():
    """Get user_id from JWT token and convert to int"""
    user_id = get_jwt_identity()
    if isinstance(user_id, str):
        user_id = int(user_id)
    return user_id

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ==================== UPLOAD DOCUMENT ====================
@quiz_bp.route("/upload-document", methods=["POST"])
@jwt_required()
def upload_document():
    """Upload document for quiz generation"""
    try:
        user_id = get_user_id()
        user = User.query.get(user_id)
        
        print(f"Upload attempt - User ID: {user_id}, User: {user}")
        
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        if not user.is_admin:
            return jsonify({"message": "Admin access required. Only admins can upload documents"}), 403
        
        # Log request details
        print(f"Request files: {request.files.keys()}")
        print(f"Request form: {request.form.keys()}")
        
        if 'file' not in request.files:
            error_msg = f"No file provided. Available files: {list(request.files.keys())}"
            print(error_msg)
            return jsonify({"message": error_msg}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"message": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"message": f"Invalid file type '{file.filename.rsplit('.', 1)[1].lower()}'. Allowed: txt, pdf, doc, docx, md"}), 400
        
        # Create upload folder if it doesn't exist
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)
        
        # Save file with secure filename
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        file.save(filepath)
        
        # Trigger embedding creation (integrate with RAG system)
        try:
            from routes.rag_chatbot import create_document_embeddings
            create_document_embeddings(filepath)
        except Exception as e:
            print(f"Warning: Could not create embeddings: {e}")
        
        # Create notifications for all students (non-admin users)
        try:
            all_students = User.query.filter_by(is_admin=False).all()
            for student in all_students:
                notification = Notification(
                    user_id=student.id,
                    title="New Document Available",
                    message=f"A new document '{filename}' has been uploaded. Check it out!",
                    notification_type="document_upload"
                )
                db.session.add(notification)
            db.session.commit()
        except Exception as e:
            print(f"Warning: Could not create notifications: {e}")
        
        return jsonify({
            "message": "Document uploaded successfully!",
            "filename": unique_filename,
            "filepath": filepath
        }), 201
    
    except Exception as e:
        return jsonify({"message": f"Upload error: {str(e)}"}), 500


# ==================== GENERATE QUIZ ====================
@quiz_bp.route("/generate-quiz", methods=["POST"])
@jwt_required()
def generate_quiz():
    """Generate quiz from uploaded document using LLM"""
    try:
        user_id = get_user_id()
        user = User.query.get(user_id)
        
        if not user or not user.is_admin:
            return jsonify({"message": "Admin access required"}), 403
        
        data = request.json
        document_path = data.get('document_path')
        title = data.get('title', 'Quiz')
        description = data.get('description', '')
        num_questions = data.get('num_questions', 5)
        
        if not document_path or not os.path.exists(document_path):
            return jsonify({"message": "Invalid document path"}), 400
        
        # Read document content based on file type
        try:
            file_ext = os.path.splitext(document_path)[1].lower()
            
            if file_ext == '.pdf':
                # Read PDF
                if PdfReader is None:
                    return jsonify({"message": "PDF support not available. Please install PyPDF2."}), 500
                
                content = ""
                with open(document_path, 'rb') as pdf_file:
                    pdf_reader = PdfReader(pdf_file)
                    for page in pdf_reader.pages:
                        content += page.extract_text() + "\n"
            else:
                # Read as text file
                with open(document_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
        except Exception as e:
            return jsonify({"message": f"Error reading document: {str(e)}"}), 500
        
        if not content or len(content.strip()) == 0:
            return jsonify({"message": "Document is empty or cannot be read"}), 400
        
        # Generate quiz using LLM
        from langchain_groq import ChatGroq
        
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            api_key=os.environ.get('GROQ_API_KEY')
        )
        
        prompt = f"""Based on the following document content, generate a quiz with {num_questions} questions.

Document Content:
{content[:3000]}

Generate a quiz in the following JSON format:
{{
    "questions": [
        {{
            "question": "Question text here?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": "Option A",
            "explanation": "Brief explanation of why this is correct"
        }}
    ]
}}

Make sure questions are relevant, clear, and test understanding of the document content.
Return ONLY the JSON, no additional text."""

        response = llm.invoke(prompt)
        
        # Parse LLM response
        try:
            quiz_data = json.loads(response.content)
            questions = quiz_data.get('questions', [])
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            if json_match:
                quiz_data = json.loads(json_match.group())
                questions = quiz_data.get('questions', [])
            else:
                return jsonify({"message": "Error parsing quiz from LLM response"}), 500
        
        # Create quiz in database
        new_quiz = Quiz(
            title=title,
            description=description,
            document_name=os.path.basename(document_path),
            questions=questions,
            created_by=user_id
        )
        
        db.session.add(new_quiz)
        db.session.commit()
        
        # Create notifications for all students (non-admin users)
        try:
            all_students = User.query.filter_by(is_admin=False).all()
            for student in all_students:
                notification = Notification(
                    user_id=student.id,
                    title="New Quiz Available",
                    message=f"A new quiz '{title}' has been generated. Test your knowledge!",
                    notification_type="quiz_created",
                    related_id=new_quiz.id
                )
                db.session.add(notification)
            db.session.commit()
        except Exception as e:
            print(f"Warning: Could not create notifications: {e}")
        
        return jsonify({
            "message": "Quiz generated successfully!",
            "quiz": new_quiz.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error generating quiz: {str(e)}"}), 500


# ==================== GET ALL QUIZZES ====================
@quiz_bp.route("/quizzes", methods=["GET"])
@jwt_required()
def get_quizzes():
    """Get all active quizzes"""
    try:
        quizzes = Quiz.query.filter_by(is_active=True).order_by(Quiz.created_at.desc()).all()
        return jsonify({
            "quizzes": [quiz.to_dict() for quiz in quizzes]
        }), 200
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== GET QUIZ BY ID ====================
@quiz_bp.route("/quizzes/<int:quiz_id>", methods=["GET"])
@jwt_required()
def get_quiz(quiz_id):
    """Get specific quiz details"""
    try:
        quiz = Quiz.query.get(quiz_id)
        
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        return jsonify({"quiz": quiz.to_dict()}), 200
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== SUBMIT QUIZ ====================
@quiz_bp.route("/submit-quiz", methods=["POST"])
@jwt_required()
def submit_quiz():
    """Submit quiz answers and get auto-graded results"""
    try:
        user_id = get_user_id()
        data = request.json
        
        quiz_id = data.get('quiz_id')
        answers = data.get('answers', [])  # List of user answers
        
        if not quiz_id:
            return jsonify({"message": "Quiz ID required"}), 400
        
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Auto-grade using LLM
        from langchain_groq import ChatGroq
        
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            api_key=os.environ.get('GROQ_API_KEY')
        )
        
        grading_prompt = f"""Grade the following quiz answers and provide feedback.

Quiz Questions and Correct Answers:
{json.dumps(quiz.questions, indent=2)}

User Answers:
{json.dumps(answers, indent=2)}

Provide a JSON response with:
1. Score (number of correct answers)
2. Detailed feedback for each question

Response format:
{{
    "score": <number>,
    "total": <total_questions>,
    "feedback": [
        {{
            "question_number": 1,
            "is_correct": true/false,
            "user_answer": "...",
            "correct_answer": "...",
            "explanation": "..."
        }}
    ]
}}

Return ONLY the JSON, no additional text."""

        response = llm.invoke(grading_prompt)
        
        # Parse grading results
        try:
            grading_data = json.loads(response.content)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            if json_match:
                grading_data = json.loads(json_match.group())
            else:
                # Fallback: simple grading
                score = sum(1 for i, ans in enumerate(answers) if i < len(quiz.questions) and ans == quiz.questions[i].get('correct_answer'))
                grading_data = {
                    "score": score,
                    "total": len(quiz.questions),
                    "feedback": []
                }
        
        score = grading_data.get('score', 0)
        total = grading_data.get('total', len(quiz.questions))
        feedback = grading_data.get('feedback', [])
        
        # Save result to database
        quiz_result = QuizResult(
            quiz_id=quiz_id,
            user_id=user_id,
            answers=answers,
            score=score,
            total_questions=total,
            feedback=feedback
        )
        
        db.session.add(quiz_result)
        db.session.commit()
        
        return jsonify({
            "message": "Quiz submitted successfully!",
            "score": score,
            "total": total,
            "percentage": round((score / total * 100), 2) if total > 0 else 0,
            "feedback": feedback
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error submitting quiz: {str(e)}"}), 500


# ==================== GET USER QUIZ RESULTS ====================
@quiz_bp.route("/my-results", methods=["GET"])
@jwt_required()
def get_my_results():
    """Get current user's quiz results"""
    try:
        user_id = get_user_id()
        results = QuizResult.query.filter_by(user_id=user_id).order_by(QuizResult.completed_at.desc()).all()
        
        return jsonify({
            "results": [result.to_dict() for result in results]
        }), 200
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== GET ALL RESULTS (ADMIN) ====================
@quiz_bp.route("/all-results", methods=["GET"])
@jwt_required()
def get_all_results():
    """Get all quiz results (admin only)"""
    try:
        user_id = get_user_id()
        user = User.query.get(user_id)
        
        if not user or not user.is_admin:
            return jsonify({"message": "Admin access required"}), 403
        
        results = QuizResult.query.order_by(QuizResult.completed_at.desc()).all()
        
        return jsonify({
            "results": [result.to_dict() for result in results]
        }), 200
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== GET UPLOADED DOCUMENTS ====================
@quiz_bp.route("/uploaded-documents", methods=["GET"])
@jwt_required()
def get_uploaded_documents():
    """Get list of uploaded documents"""
    try:
        user_id = get_user_id()
        user = User.query.get(user_id)
        
        if not user or not user.is_admin:
            return jsonify({"message": "Admin access required"}), 403
        
        documents = []
        
        # Check upload folder
        if os.path.exists(UPLOAD_FOLDER):
            for filename in os.listdir(UPLOAD_FOLDER):
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                if os.path.isfile(filepath) and allowed_file(filename):
                    stat = os.stat(filepath)
                    documents.append({
                        "filename": filename,
                        "filepath": filepath,
                        "uploaded_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
        
        # Sort by upload time (newest first)
        documents.sort(key=lambda x: x['uploaded_at'], reverse=True)
        
        return jsonify({
            "documents": documents
        }), 200
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500
