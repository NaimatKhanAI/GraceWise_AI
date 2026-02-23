from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(override=True)

# Disable LangChain tracing/telemetry to avoid Pydantic v1 inference errors on Python 3.14
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGCHAIN_TRACING"] = "false"
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGSMITH_TRACING_V2"] = "false"

from flask_sqlalchemy import SQLAlchemy
from routes.dashboard import dashboard_bp
from routes.devotionals import devotionals_bp
from routes.child_progress import child_progress_bp
from routes.planner import planner_bp
from routes.curriculum import curriculum_bp
from models import db  # import db from models.py
from routes.rag_chatbot import rag_bp 
from routes.auth import auth_bp
from routes.quiz import quiz_bp

#Create Flask app
app = Flask(__name__)

# Enable CORS for frontend communication
CORS(app, resources={r"/*": {"origins": "*"}})

# Always return OK for CORS preflight requests
@app.before_request
def handle_options_preflight():
    if request.method == "OPTIONS":
        return "", 200

# #Configure the database
# app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://root:@localhost/gracewise"
# app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///gracewise.db')

# app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://root:@localhost/gracewise"
app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://graceuser:StrongPass123!@localhost/gracewise"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

#Initialize JWT
jwt = JWTManager(app)

#Initialize database with app
db.init_app(app)

#Register blueprints
app.register_blueprint(auth_bp, url_prefix="/auth")
app.register_blueprint(dashboard_bp, url_prefix="/dashboard")
app.register_blueprint(devotionals_bp, url_prefix="/devotionals")
app.register_blueprint(child_progress_bp, url_prefix="/child_progress")
app.register_blueprint(planner_bp, url_prefix="/planner")
app.register_blueprint(curriculum_bp, url_prefix="/curriculum")
app.register_blueprint(rag_bp, url_prefix="/rag")
app.register_blueprint(quiz_bp, url_prefix="/quiz")

#Create tables (optional, for first run)
with app.app_context():
    db.create_all()
    
    # Migrate planner table if needed
    try:
        from sqlalchemy import text
        inspector = db.inspect(db.engine)
        
        if 'planner' in inspector.get_table_names():
            existing_columns = [col['name'] for col in inspector.get_columns('planner')]
            
            columns_to_add = []
            if 'start_time' not in existing_columns:
                columns_to_add.append("ADD COLUMN start_time VARCHAR(10)")
            if 'end_time' not in existing_columns:
                columns_to_add.append("ADD COLUMN end_time VARCHAR(10)")
            if 'subject' not in existing_columns:
                columns_to_add.append("ADD COLUMN subject VARCHAR(100)")
            if 'subtitle' not in existing_columns:
                columns_to_add.append("ADD COLUMN subtitle VARCHAR(150)")
            if 'created_at' not in existing_columns:
                columns_to_add.append("ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
            if 'updated_at' not in existing_columns:
                columns_to_add.append("ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
            
            if columns_to_add:
                print("\n" + "="*50)
                print(f"Migrating planner table - adding {len(columns_to_add)} columns...")
                print("="*50)
                for column_def in columns_to_add:
                    sql = f"ALTER TABLE planner {column_def}"
                    db.session.execute(text(sql))
                db.session.commit()
                print("✅ Planner table migration completed!")
                print("="*50 + "\n")
    except Exception as e:
        print(f"⚠️  Planner migration note: {str(e)}")
        db.session.rollback()
    
    # Initialize admin user
    from models import User, AppSetting
    from routes.rag_chatbot import AI_PROMPT_KEY, DEFAULT_AI_PROMPT
    admin_email = "admin@grace-wise.com"
    admin = User.query.filter_by(email=admin_email).first()
    
    if not admin:
        print("\n" + "="*50)
        print("Creating admin user...")
        print("="*50)
        admin = User(
            first_name="Admin",
            last_name="User",
            email=admin_email,
            is_admin=True
        )
        admin.set_password("grace.admin@123")
        db.session.add(admin)
        db.session.commit()
        print(f"Admin user created: {admin_email}")
        print("="*50 + "\n")
    else:
        print(f"\nAdmin user already exists: {admin_email}\n")

    prompt_setting = AppSetting.query.filter_by(setting_key=AI_PROMPT_KEY).first()
    if not prompt_setting:
        prompt_setting = AppSetting(setting_key=AI_PROMPT_KEY, setting_value=DEFAULT_AI_PROMPT)
        db.session.add(prompt_setting)
        db.session.commit()
        print("Default AI prompt initialized.")

#Initialize RAG system on startup
with app.app_context():
    from routes.rag_chatbot import get_qa_chain
    print("\n" + "="*50)
    print("Initializing RAG system at startup...")
    print("="*50)
    get_qa_chain()
    print("RAG system ready for requests.\n")

#Run the app
if __name__ == "__main__":
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000, threaded=True)

