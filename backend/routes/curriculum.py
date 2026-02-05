from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import shutil
from datetime import datetime
from models import db, Curriculum, Module, Lesson, User, Notification

curriculum_bp = Blueprint("curriculum", __name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'documents')
ALLOWED_EXTENSIONS = {'pdf', 'txt'}
IGNORE_FOLDERS = {'__pycache__', 'avatars'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def sanitize_folder_name(name):
    """Sanitize folder name by removing special characters"""
    import re
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[-\s]+', '_', name)
    return name


def get_curriculum_folder(curriculum):
    if curriculum.folder_name:
        return curriculum.folder_name
    return sanitize_folder_name(curriculum.title)


def get_module_folder(module):
    if module.folder_name:
        return module.folder_name
    return sanitize_folder_name(module.name)


def build_relative_path(*parts):
    return os.path.join(*parts)


def ensure_folder(path):
    os.makedirs(path, exist_ok=True)


# ==================== CURRICULUM ROUTES ====================

# Create curriculum
@curriculum_bp.route("/", methods=["POST"])
@jwt_required()
def create_curriculum():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({"error": "Admin access required"}), 403
    
    data = request.json
    
    folder_name = sanitize_folder_name(data["title"])
    curriculum = Curriculum(
        title=data["title"],
        description=data["description"],
        age_group=data.get("age_group"),
        week=data.get("week"),
        devotional_id=data.get("devotional_id"),
        folder_name=folder_name
    )
    
    db.session.add(curriculum)
    db.session.commit()
    
    # Create folder for curriculum
    curriculum_path = os.path.join(UPLOAD_FOLDER, folder_name)
    ensure_folder(curriculum_path)
    
    # Notify all non-admin users
    users = User.query.filter_by(is_admin=False).all()
    for u in users:
        notification = Notification(
            user_id=u.id,
            title="New Curriculum Added",
            message=f"New curriculum '{curriculum.title}' has been added.",
            notification_type="curriculum",
            related_id=curriculum.id
        )
        db.session.add(notification)
    db.session.commit()
    
    return jsonify({
        "message": "Curriculum created successfully",
        "curriculum": curriculum.to_dict()
    }), 201


# Get all curriculum with modules and lessons
@curriculum_bp.route("/", methods=["GET"])
def get_all_curriculum():
    include_modules = request.args.get('include_modules', 'false').lower() == 'true'
    items = Curriculum.query.order_by(Curriculum.created_at.desc()).all()
    
    return jsonify([c.to_dict(include_modules=include_modules) for c in items])


# Get single curriculum with full details
@curriculum_bp.route("/<int:id>", methods=["GET"])
def get_curriculum(id):
    c = Curriculum.query.get_or_404(id)
    
    # Get modules with their lessons
    modules = []
    for module in c.modules:
        module_dict = module.to_dict()
        module_dict['lessons'] = [lesson.to_dict() for lesson in module.lessons]
        modules.append(module_dict)
    
    result = c.to_dict()
    result['modules'] = modules
    
    return jsonify(result)


# Delete curriculum
@curriculum_bp.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_curriculum(id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({"error": "Admin access required"}), 403
    
    curriculum = Curriculum.query.get_or_404(id)
    
    # Delete folder and all contents
    curriculum_folder = get_curriculum_folder(curriculum)
    curriculum_path = os.path.join(UPLOAD_FOLDER, curriculum_folder)
    if os.path.exists(curriculum_path):
        shutil.rmtree(curriculum_path)
    
    db.session.delete(curriculum)
    db.session.commit()
    
    return jsonify({"message": "Curriculum deleted successfully"})


# ==================== MODULE ROUTES ====================

# Create module
@curriculum_bp.route("/<int:curriculum_id>/module", methods=["POST"])
@jwt_required()
def create_module(curriculum_id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({"error": "Admin access required"}), 403
    
    curriculum = Curriculum.query.get_or_404(curriculum_id)
    data = request.json
    
    # Get the next order number
    max_order = db.session.query(db.func.max(Module.order)).filter_by(curriculum_id=curriculum_id).scalar() or 0
    
    folder_name = sanitize_folder_name(data["name"])
    module = Module(
        curriculum_id=curriculum_id,
        name=data["name"],
        description=data.get("description", ""),
        order=max_order + 1,
        folder_name=folder_name
    )
    
    db.session.add(module)
    db.session.commit()
    
    # Create folder for module
    curriculum_folder = get_curriculum_folder(curriculum)
    module_folder = get_module_folder(module)
    module_path = os.path.join(UPLOAD_FOLDER, curriculum_folder, module_folder)
    ensure_folder(module_path)
    
    return jsonify({
        "message": "Module created successfully",
        "module": module.to_dict()
    }), 201


# Get all modules for a curriculum
@curriculum_bp.route("/<int:curriculum_id>/modules", methods=["GET"])
def get_modules(curriculum_id):
    modules = Module.query.filter_by(curriculum_id=curriculum_id).order_by(Module.order).all()
    return jsonify([m.to_dict() for m in modules])


# Delete module
@curriculum_bp.route("/module/<int:module_id>", methods=["DELETE"])
@jwt_required()
def delete_module(module_id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({"error": "Admin access required"}), 403
    
    module = Module.query.get_or_404(module_id)
    curriculum = module.curriculum
    
    # Delete folder and all contents
    curriculum_folder = get_curriculum_folder(curriculum)
    module_folder = get_module_folder(module)
    module_path = os.path.join(UPLOAD_FOLDER, curriculum_folder, module_folder)
    if os.path.exists(module_path):
        shutil.rmtree(module_path)
    
    db.session.delete(module)
    db.session.commit()
    
    return jsonify({"message": "Module deleted successfully"})


# ==================== LESSON ROUTES ====================

# Upload lesson
@curriculum_bp.route("/module/<int:module_id>/lesson", methods=["POST"])
@jwt_required()
def upload_lesson(module_id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({"error": "Admin access required"}), 403
    
    module = Module.query.get_or_404(module_id)
    curriculum = module.curriculum
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "Only PDF and TXT files are allowed"}), 400
    
    # Get form data
    name = request.form.get('name', file.filename)
    description = request.form.get('description', '')
    
    # Secure filename and save
    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{timestamp}_{filename}"
    
    curriculum_folder = get_curriculum_folder(curriculum)
    module_folder = get_module_folder(module)
    module_path = os.path.join(UPLOAD_FOLDER, curriculum_folder, module_folder)
    ensure_folder(module_path)
    
    file_path = os.path.join(module_path, unique_filename)
    file.save(file_path)
    
    # Get file size
    file_size = os.path.getsize(file_path)
    file_type = filename.rsplit('.', 1)[1].lower()
    
    # Store relative path for portability
    relative_path = build_relative_path(curriculum_folder, module_folder, unique_filename)
    
    # Get the next order number
    max_order = db.session.query(db.func.max(Lesson.order)).filter_by(module_id=module_id).scalar() or 0
    
    # Create lesson record
    lesson = Lesson(
        module_id=module_id,
        name=name,
        description=description,
        file_path=relative_path,
        file_type=file_type,
        file_size=file_size,
        order=max_order + 1
    )
    
    db.session.add(lesson)
    db.session.commit()
    
    # Notify all non-admin users
    users = User.query.filter_by(is_admin=False).all()
    for u in users:
        notification = Notification(
            user_id=u.id,
            title="New Lesson Added",
            message=f"New lesson '{lesson.name}' has been added to {module.name} in {curriculum.title}.",
            notification_type="lesson",
            related_id=lesson.id
        )
        db.session.add(notification)
    db.session.commit()
    
    return jsonify({
        "message": "Lesson uploaded successfully",
        "lesson": lesson.to_dict()
    }), 201


# Get all lessons for a module
@curriculum_bp.route("/module/<int:module_id>/lessons", methods=["GET"])
def get_lessons(module_id):
    lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
    return jsonify([l.to_dict() for l in lessons])


# Delete lesson
@curriculum_bp.route("/lesson/<int:lesson_id>", methods=["DELETE"])
@jwt_required()
def delete_lesson(lesson_id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({"error": "Admin access required"}), 403
    
    lesson = Lesson.query.get_or_404(lesson_id)
    
    # Delete file
    file_path = os.path.join(UPLOAD_FOLDER, lesson.file_path)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    db.session.delete(lesson)
    db.session.commit()
    
    return jsonify({"message": "Lesson deleted successfully"})


# ==================== SYNC EXISTING FOLDERS ====================

@curriculum_bp.route("/sync-folders", methods=["POST"])
@jwt_required()
def sync_folders():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user or not user.is_admin:
        return jsonify({"error": "Admin access required"}), 403

    if not os.path.exists(UPLOAD_FOLDER):
        return jsonify({"message": "Documents folder not found", "synced": 0})

    synced_count = 0

    for entry in os.listdir(UPLOAD_FOLDER):
        curriculum_path = os.path.join(UPLOAD_FOLDER, entry)
        if not os.path.isdir(curriculum_path):
            continue
        if entry in IGNORE_FOLDERS:
            continue

        curriculum = Curriculum.query.filter_by(title=entry).first()
        if not curriculum:
            curriculum = Curriculum(
                title=entry,
                description="Imported from existing folder",
                folder_name=entry
            )
            db.session.add(curriculum)
            db.session.flush()
            synced_count += 1
        elif not curriculum.folder_name:
            curriculum.folder_name = entry

        # Build modules from immediate subfolders or files in curriculum root
        subfolders = [
            name for name in os.listdir(curriculum_path)
            if os.path.isdir(os.path.join(curriculum_path, name)) and name not in IGNORE_FOLDERS
        ]

        files_in_root = [
            name for name in os.listdir(curriculum_path)
            if os.path.isfile(os.path.join(curriculum_path, name)) and allowed_file(name)
        ]

        if files_in_root:
            subfolders.append("General")

        for module_name in subfolders:
            module_path = os.path.join(curriculum_path, module_name)
            if module_name == "General":
                module_path = curriculum_path

            module = Module.query.filter_by(curriculum_id=curriculum.id, name=module_name).first()
            if not module:
                module = Module(
                    curriculum_id=curriculum.id,
                    name=module_name,
                    description="Imported from existing folder",
                    folder_name=module_name
                )
                db.session.add(module)
                db.session.flush()
                synced_count += 1
            elif not module.folder_name:
                module.folder_name = module_name

            for root, _, files in os.walk(module_path):
                for filename in files:
                    if not allowed_file(filename):
                        continue

                    full_path = os.path.join(root, filename)
                    relative_dir = os.path.relpath(root, UPLOAD_FOLDER)
                    relative_path = build_relative_path(relative_dir, filename)

                    existing_lesson = Lesson.query.filter_by(file_path=relative_path).first()
                    if existing_lesson:
                        continue

                    file_size = os.path.getsize(full_path)
                    file_type = filename.rsplit('.', 1)[1].lower()
                    name = os.path.splitext(filename)[0].replace('_', ' ').strip()

                    lesson = Lesson(
                        module_id=module.id,
                        name=name or filename,
                        description="Imported from existing file",
                        file_path=relative_path,
                        file_type=file_type,
                        file_size=file_size
                    )
                    db.session.add(lesson)
                    synced_count += 1

    db.session.commit()

    return jsonify({"message": "Folders synced successfully", "synced": synced_count})


@curriculum_bp.route("/sync-folders", methods=["OPTIONS"])
def sync_folders_options():
    return "", 200
