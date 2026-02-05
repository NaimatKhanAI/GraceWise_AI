from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User
from datetime import timedelta, datetime

auth_bp = Blueprint("auth", __name__)

def get_user_id():
    """Get user_id from JWT token and convert to int"""
    user_id = get_jwt_identity()
    if isinstance(user_id, str):
        user_id = int(user_id)
    return user_id

# ==================== SIGNUP ====================
@auth_bp.route("/signup", methods=["POST"])
def signup():
    """Register a new user"""
    try:
        data = request.json
        
        # Validate required fields
        if not data or not data.get('email') or not data.get('password') or not data.get('first_name'):
            return jsonify({"message": "Missing required fields: email, password, first_name"}), 400
        
        email = data.get('email').strip().lower()
        password = data.get('password')
        first_name = data.get('first_name')
        last_name = data.get('last_name', '')
        
        # Validate email format
        if '@' not in email:
            return jsonify({"message": "Invalid email format"}), 400
        
        # Validate password strength
        if len(password) < 6:
            return jsonify({"message": "Password must be at least 6 characters long"}), 400
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({"message": "Email already registered. Please sign in instead."}), 409
        
        # Create new user
        new_user = User(
            first_name=first_name,
            last_name=last_name,
            email=email
        )
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            "message": "User registered successfully!",
            "user": new_user.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error during registration: {str(e)}"}), 500


# ==================== LOGIN ====================
@auth_bp.route("/login", methods=["POST"])
def login():
    """User login and token generation"""
    try:
        data = request.json
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({"message": "Missing email or password"}), 400
        
        email = data.get('email').strip().lower()
        password = data.get('password')
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({"message": "Invalid email or password"}), 401
        
        if not user.is_active:
            return jsonify({"message": "User account is inactive"}), 403
        
        # Create access token
        access_token = create_access_token(
            identity=str(user.id),  # Convert to string to ensure proper JWT encoding
            expires_delta=timedelta(days=30)
        )
        
        return jsonify({
            "message": "Login successful!",
            "access_token": access_token,
            "user": user.to_dict()
        }), 200
    
    except Exception as e:
        return jsonify({"message": f"Login error: {str(e)}"}), 500


# ==================== GET CURRENT USER ====================
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """Get current logged-in user information"""
    try:
        user_id = get_user_id()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        return jsonify({"user": user.to_dict()}), 200
    
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== GET ALL USERS (ADMIN ONLY) ====================
@auth_bp.route("/all-users", methods=["GET"])
@jwt_required()
def get_all_users():
    """Get all users (admin only)"""
    try:
        user_id = get_user_id()
        current_user = User.query.get(user_id)
        
        if not current_user or not current_user.is_admin:
            return jsonify({"message": "Admin access required"}), 403
        
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '', type=str)
        
        # Build query
        query = User.query
        
        # Apply search filter
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    User.first_name.ilike(search_term),
                    User.last_name.ilike(search_term),
                    User.email.ilike(search_term)
                )
            )
        
        # Order by most recent first
        query = query.order_by(User.created_at.desc())
        
        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        users = [user.to_dict() for user in pagination.items]
        
        return jsonify({
            "users": users,
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "total_pages": pagination.pages
        }), 200
    
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== UPDATE USER ====================
@auth_bp.route("/update", methods=["PUT"])
@jwt_required()
def update_user():
    """Update user information"""
    try:
        user_id = get_user_id()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        data = request.json
        
        if 'first_name' in data:
            user.first_name = data['first_name']
        
        if 'last_name' in data:
            user.last_name = data['last_name']
        
        db.session.commit()
        
        return jsonify({
            "message": "User updated successfully!",
            "user": user.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== CHANGE PASSWORD ====================
@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """Change user password"""
    try:
        user_id = get_user_id()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        data = request.json
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')
        
        if not old_password or not new_password or not confirm_password:
            return jsonify({"message": "Missing required fields"}), 400
        
        if not user.check_password(old_password):
            return jsonify({"message": "Current password is incorrect"}), 401
        
        if new_password != confirm_password:
            return jsonify({"message": "New passwords do not match"}), 400
        
        if len(new_password) < 6:
            return jsonify({"message": "Password must be at least 6 characters"}), 400
        
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({"message": "Password changed successfully!"}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ==================== CHECK EMAIL ====================
@auth_bp.route("/check-email", methods=["POST"])
def check_email():
    """Check if email is available"""
    try:
        data = request.json
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({"available": False, "message": "Email is required"}), 400
        
        user = User.query.filter_by(email=email).first()
        
        return jsonify({
            "available": user is None,
            "message": "Email is available" if user is None else "Email already registered"
        }), 200
    
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500
