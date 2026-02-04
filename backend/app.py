from flask import Flask
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

#Create Flask app
app = Flask(__name__)

# Enable CORS for frontend communication
CORS(app, resources={r"/*": {"origins": "*"}})

# #Configure the database
# app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://root:@localhost/gracewise"
# app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///gracewise.db')


app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://root:@localhost/gracewise"
# app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://graceuser:StrongPass123!@localhost/gracewise"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False

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

#Create tables (optional, for first run)
with app.app_context():
    db.create_all()

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

