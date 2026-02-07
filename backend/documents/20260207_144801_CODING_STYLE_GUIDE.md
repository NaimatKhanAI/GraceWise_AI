# Flask Backend Coding Style Guide
*Analyzed from LMS Agentic Project - February 1, 2026*

## Project Overview
**Tech Stack**: Flask + SQLAlchemy + Marshmallow + LangChain + LangGraph
**Architecture**: Layered architecture (Routes → Services → Models)
**Database**: MySQL
**Authentication**: JWT + Bcrypt
**AI Integration**: LangGraph agents with role-based tools

---

## 1. PROJECT STRUCTURE & ORGANIZATION

### Directory Layout
```
backend/
├── app.py                 # Flask app initialization
├── requirements.txt       # Dependencies
└── src/
    ├── __init__.py       # create_app() factory function
    ├── db.py            # SQLAlchemy instance
    ├── extention.py     # JWT & Bcrypt initialization
    ├── models/          # Database models
    ├── routes/          # Flask blueprints (API endpoints)
    ├── schemas/         # Marshmallow validation schemas
    ├── services/        # Business logic layer
    └── agent/           # LangGraph chatbot agents
```

### Key Pattern: Separation of Concerns
- **Models**: Database schemas only (no business logic)
- **Services**: All business logic, returns `jsonify()` responses
- **Routes**: Request handling, auth validation, schema validation
- **Agent**: AI-driven tool calling with role-based access control

---

## 2. APP INITIALIZATION & CONFIGURATION

### Main App Factory (src/__init__.py)
```python
def create_app():
    app = Flask(__name__)
    
    # CORS Configuration
    CORS(app, resources={r"/api/*": {...}})
    
    # Configuration from environment variables
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URI")
    
    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    
    # Register all blueprints
    app.register_blueprint(home_bp)
    app.register_blueprint(auth_bp)
    # ... more blueprints
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    return app
```

### Extension Initialization (src/extention.py)
```python
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt

jwt = JWTManager()
bcrypt = Bcrypt()
```

### Database Connection (src/db.py)
```python
from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()
```

### Main Entry Point (app.py)
```python
from src import create_app

app = create_app()

if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG").lower() == "true"
    port = int(os.getenv("PORT"))
    app.run(debug=debug_mode, port=port)
```

---

## 3. DATABASE MODELS

### Naming Conventions
- **Class names**: PascalCase (Student, Teacher, Assignment)
- **Table names**: plural lowercase (students, teachers, assignments)
- **Primary key**: `id` (db.BigInteger, autoincrement)
- **Foreign keys**: `entity_id` convention (teacher_id, section_id, course_id)

### Standard Model Structure
```python
from src.db import db
from src.extention import bcrypt
from datetime import datetime
from zoneinfo import ZoneInfo

class Student(db.Model):
    __tablename__ = 'students'
    
    # Primary key
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    
    # Regular columns
    name = db.Column(db.String(255), nullable=False)
    username = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    password = db.Column(db.String(255), nullable=False)
    
    # Foreign keys
    section_id = db.Column(db.BigInteger, db.ForeignKey("sections.id"), nullable=False)
    
    # Relationships
    courses = db.relationship('Course', secondary='enrollment', backref='students', lazy=True)
    section = db.relationship('Section', backref='students', lazy=True)
    
    # Timestamps (with timezone awareness)
    created_at = db.Column(db.DateTime, default=datetime.now(ZoneInfo("Asia/Karachi")))
    
    # Methods for authentication
    def set_password(self, password):
        if not isinstance(password, str) or not password:
            raise ValueError("Password must be a non-empty string")
        self.password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    def check_password(self, password):
        if not isinstance(password, str) or not password:
            return False
        return bcrypt.check_password_hash(self.password, password)
```

### Password Handling Pattern
```python
# Always include validation
def set_password(self, password):
    if not isinstance(password, str) or not password:
        raise ValueError("Password must be a non-empty string")
    self.password = bcrypt.generate_password_hash(password).decode('utf-8')

def check_password(self, password):
    if not isinstance(password, str) or not password:
        return False
    return bcrypt.check_password_hash(self.password, password)
```

### Data Types Used
- `db.BigInteger` - for IDs and large numbers
- `db.String(255)` - for names, usernames, emails
- `db.Text` - for descriptions, content
- `db.Date` - for dates without time
- `db.DateTime` - for timestamps
- `db.Numeric(5, 2)` - for marks/scores with decimals

---

## 4. MARSHMALLOW SCHEMAS (DATA VALIDATION)

### Naming Convention
- Schema class names: `EntitySchema` or `Entity{Action}Schema`
- Examples: `LoginSchema`, `RegisterStudentSchema`, `UpdateTeacherSchema`

### Schema Structure
```python
from marshmallow import Schema, fields, validate

class RegisterStudentSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=3, max=100))
    username = fields.String(required=True, validate=validate.Length(min=3, max=100))
    email = fields.Email(required=True)
    section_name = fields.String(required=True)
    password = fields.String(required=True, validate=validate.Length(min=6))

class UpdateStudentSchema(Schema):
    name = fields.String(required=False, validate=validate.Length(min=3, max=100))
    username = fields.String(required=False, validate=validate.Length(min=3, max=100))
    email = fields.Email(required=False)
    password = fields.String(required=False, validate=validate.Length(min=6))
```

### Validation Pattern
- Always include `required=True/False`
- Use `validate=` for field-level validation
- `validate.Length()` for string length constraints
- `fields.Email()` for email fields
- Create separate schemas for create/update operations (create is stricter)

---

## 5. ROUTES (Flask Blueprints)

### Blueprint Setup Pattern
```python
from flask import Blueprint, request, jsonify
from src.services import service_function
from src.schemas import EntitySchema
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from marshmallow import ValidationError

entity_bp = Blueprint("entity", __name__)
```

### Route Structure
```python
@entity_bp.route("/api/add/entity", methods=["POST"])
@jwt_required()
def add_entity():
    # 1. Role-based authorization check
    token = get_jwt()
    if token["role"] != "admin":
        return jsonify({
            "message": "only admins can add entity",
            "status": "failed"
        }), 403
    
    # 2. Schema validation
    try:
        data = EntitySchema().load(request.get_json())
    except ValidationError as e:
        return jsonify(e.messages), 400
    
    # 3. Business logic lookup (if needed)
    related_entity = RelatedModel.query.filter_by(name=data['related_name']).first()
    if not related_entity:
        return jsonify({
            "message": "Related entity not found",
            "status": "failed"
        }), 400
    
    # 4. Call service function
    result = add_entity(
        field1=data['field1'],
        field2=data['field2'],
        related_id=related_entity.id
    )
    
    return result
```

### Common Route Patterns

#### GET with Optional ID
```python
@entity_bp.route("/api/get/entity", methods=["GET"])
@jwt_required()
def get_entity():
    entity_id = request.args.get("id", type=int)
    
    if entity_id is None:
        return get_all_entities()
    
    return get_entity_by_id(entity_id)
```

#### Role-Based Access Control
```python
token = get_jwt()
if token["role"] != "admin":
    return jsonify({"message": "only admins...", "status": "failed"}), 403
```

#### User Identity
```python
user_id = int(get_jwt_identity())
# Use for user-specific operations
if entity_id != user_id:
    return jsonify({"message": "unauthorized"}), 403
```

---

## 6. SERVICES (Business Logic Layer)

### Service Function Naming
- `add_entity()` - create new record
- `get_entity_by_id()` - retrieve single record
- `get_all_entities()` - retrieve all records
- `update_entity()` - modify record
- `delete_entity()` - remove record

### Service Function Structure
```python
from src.models import Entity
from flask import jsonify
from src.db import db

def add_entity(field1, field2, field3):
    # 1. Validation
    existing = Entity.query.filter_by(email=field1).first()
    if existing:
        return jsonify({
            "message": "Email already exists",
            "status": "failed"
        }), 400
    
    # 2. Model instantiation
    new_entity = Entity(
        field1=field1,
        field2=field2,
        field3=field3
    )
    
    # 3. Database operations
    db.session.add(new_entity)
    db.session.commit()
    
    # 4. JSON response
    return jsonify({
        "message": "entity added successfully",
        "status": "success"
    }), 201

def get_all_entities():
    entities = Entity.query.all()
    
    if not entities:
        return jsonify({
            "message": "no entities found",
            "status": "failed"
        }), 404
    
    entity_list = []
    for entity in entities:
        entity_data = {
            "id": entity.id,
            "field1": entity.field1,
            "related_name": entity.related_entity.name,
        }
        entity_list.append(entity_data)
    
    return jsonify(entity_list)

def get_entity_by_id(entity_id):
    entity = Entity.query.get(entity_id)
    
    if not entity:
        return jsonify({
            "message": "entity not found",
            "status": "failed"
        }), 404
    
    entity_data = {
        "id": entity.id,
        "field1": entity.field1,
    }
    
    return jsonify({"entity": entity_data})

def update_entity(entity_id, **kwargs):
    entity = Entity.query.get(entity_id)
    
    if not entity:
        return jsonify({
            "message": "entity not found",
            "status": "failed"
        }), 400
    
    for key, value in kwargs.items():
        if value is not None and hasattr(entity, key):
            setattr(entity, key, value)
    
    db.session.commit()
    
    return jsonify({
        "message": "entity updated successfully",
        "status": "success"
    })

def delete_entity(entity_id):
    entity = Entity.query.get(entity_id)
    
    if not entity:
        return jsonify({
            "message": "entity not found",
            "status": "failed"
        }), 404
    
    # Handle cascading deletes if needed
    related_entities = RelatedEntity.query.filter_by(entity_id=entity_id).all()
    for related in related_entities:
        db.session.delete(related)
    
    db.session.delete(entity)
    db.session.commit()
    
    return jsonify({
        "message": "entity deleted successfully",
        "status": "success"
    })
```

### Response Format Pattern
```python
# Success (create)
return jsonify({
    "message": "action completed successfully",
    "status": "success"
}), 201

# Success (retrieve)
return jsonify({
    "id": entity.id,
    "name": entity.name,
    # data fields
})

# Error
return jsonify({
    "message": "descriptive error message",
    "status": "failed"
}), 400/404/403
```

---

## 7. AUTHENTICATION & JWT

### JWT Initialization
```python
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
jwt.init_app(app)
```

### Login Flow
```python
@auth_bp.route('/api/login', methods=['POST'])
def login():
    # 1. Validate input
    try:
        data = loginSchema().load(request.get_json())
    except ValidationError as e:
        return jsonify(e.messages), 400
    
    email = data.get('email')
    password = data.get('password')
    
    # 2. Multi-role user lookup
    role = ''
    user = Admin.query.filter_by(email=email).first()
    if user:
        role = 'admin'
    
    if not role or not user:
        user = Teacher.query.filter_by(email=email).first()
        if user:
            role = 'teacher'
    
    if not role or not user:
        user = Student.query.filter_by(email=email).first()
        if user:
            role = 'student'
    
    if not user:
        return jsonify({
            "status": False,
            "message": "Invalid email"
        }), 401
    
    # 3. Password verification
    if not user.check_password(password):
        return jsonify({
            "status": False,
            "message": "Invalid password"
        }), 401
    
    # 4. Token generation with additional claims
    additional_claims = {
        "role": role,
        "name": user.name,
        "email": user.email,
        "username": user.username if hasattr(user, 'username') else user.email
    }
    token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
    
    return jsonify({
        "status": True,
        "message": "Login successful",
        "token": token
    })
```

### JWT Usage in Routes
```python
# Require JWT
@route.route("/api/endpoint", methods=["GET"])
@jwt_required()
def endpoint():
    token = get_jwt()           # Get claims
    user_id = get_jwt_identity() # Get user ID (identity)
    
    role = token.get("role")
    name = token.get("name")
    email = token.get("email")
```

---

## 8. AGENT & LANGGRAPH INTEGRATION

### Agent Setup Pattern
```python
from typing import TypedDict, Annotated, Sequence
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import BaseMessage
import operator

# Initialize model
model = ChatGroq(model="qwen/qwen3-32b")

# Define state
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    user_role: str
    user_info: dict
```

### Tool Definition Pattern
```python
from langchain.tools import tool
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

@tool
@jwt_required()
def tool_name(param1, param2):
    """Tool description for the AI model.
    
    Args:
        param1: Description of param1
        param2: Description of param2
    """
    # Authorization check
    token = get_jwt()
    if token.get("role") != "teacher":
        return {"message": "Only teachers can use this", "status": "failed"}
    
    # Get user identity
    user_id = int(get_jwt_identity())
    
    # Call service function
    result = service_function(param1, param2)
    
    # Extract data from response
    if isinstance(result, tuple):
        result = result[0]
    
    return result.get_json() if hasattr(result, 'get_json') else result
```

### Helper Function for Response Extraction
```python
def extract_data_from_response(response):
    """Extract JSON data from Flask response objects for agent tools.
    
    Service functions return jsonify() responses which aren't directly usable by LangChain.
    This helper extracts the actual data so the agent can work with it.
    """
    if isinstance(response, tuple):
        response = response[0]  # Get response object from (response, status_code) tuple
    
    if isinstance(response, Response):
        return response.get_json()
    
    return response
```

### Graph Creation Pattern
```python
def create_chatbot_graph(user_role: str):
    """Create a unified agent graph with parallel tool execution."""
    
    tools = get_tools_for_role(user_role)
    system_prompt = get_system_prompt_for_role(user_role)
    
    tool_node = ToolNode(tools)
    model_with_tools = model.bind_tools(tools)
    
    workflow = StateGraph(AgentState)
    
    workflow.add_node("agent", lambda state: agent_node(state, model_with_tools, system_prompt))
    workflow.add_node("tools", tool_node)
    
    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "agent")
    
    return workflow.compile()

def agent_node(state: AgentState, model_with_tools, system_prompt):
    """Agent node that calls the model."""
    messages = state["messages"]
    user_role = state.get("user_role")
    
    context_prompt = f"{system_prompt}\n\nNote: You are logged in as {user_role}."
    
    if len(messages) == 1 and isinstance(messages[0], HumanMessage):
        messages = [AIMessage(content=context_prompt)] + messages
    
    response = model_with_tools.invoke(messages)
    return {"messages": [response]}

def should_continue(state: AgentState) -> str:
    """Determine whether to continue with tools or end."""
    messages = state["messages"]
    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END
```

---

## 9. ERROR HANDLING & RESPONSE PATTERNS

### Standard HTTP Status Codes
- `200` - Success (GET)
- `201` - Created (POST)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid auth)
- `403` - Forbidden (role-based access denied)
- `404` - Not Found

### Error Response Format
```python
# Validation error
return jsonify({
    "message": "descriptive error message",
    "status": "failed"
}), 400

# Not found
return jsonify({
    "message": "entity not found",
    "status": "failed"
}), 404

# Access denied
return jsonify({
    "message": "only admins can...",
    "status": "failed"
}), 403
```

### Marshmallow Validation Error Handling
```python
try:
    data = EntitySchema().load(request.get_json())
except ValidationError as e:
    return jsonify(e.messages), 400
```

---

## 10. NAMING CONVENTIONS SUMMARY

| Item | Convention | Example |
|------|-----------|---------|
| Classes | PascalCase | `Student`, `Course`, `Assignment` |
| Tables | lowercase_plural | `students`, `courses`, `assignments` |
| Functions | snake_case | `add_student()`, `get_all_courses()` |
| Variables | snake_case | `student_id`, `course_name` |
| Constants | UPPER_SNAKE_CASE | `JWT_SECRET_KEY`, `DATABASE_URI` |
| Schemas | PascalCase + "Schema" | `RegisterStudentSchema`, `UpdateTeacherSchema` |
| Blueprints | snake_case + "_bp" | `student_bp`, `course_bp` |
| Foreign Keys | entity_id | `teacher_id`, `section_id`, `student_id` |
| Relationships | plural lowercase | `students`, `courses`, `assignments` |

---

## 11. KEY PRINCIPLES

1. **Layered Architecture**: Routes → Services → Models
   - Routes handle HTTP & auth
   - Services handle business logic
   - Models handle data

2. **DRY (Don't Repeat Yourself)**
   - Reuse service functions
   - Centralize validation in schemas

3. **Explicit Over Implicit**
   - Always check role and user_id from JWT
   - Always validate input with Marshmallow
   - Always check for None/existence before operations

4. **Consistent Response Format**
   - Always return jsonify() responses
   - Always include status/message fields for clarity

5. **Security First**
   - `@jwt_required()` on all protected routes
   - Role-based access control checks
   - Password hashing with bcrypt
   - Input validation with Marshmallow

6. **Role-Based Design**
   - Three user types: Admin, Teacher, Student
   - Each with different capabilities
   - Tools and prompts tailored per role

7. **Async-Ready**
   - LangGraph supports parallel tool execution
   - Tool schemas are cached globally
   - Message aggregation with `operator.add`

---

## 12. COMMON IMPORTS PATTERN

```python
# Flask
from flask import Flask, Blueprint, request, jsonify, Response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt, get_jwt_identity
from flask_bcrypt import Bcrypt

# Marshmallow
from marshmallow import Schema, fields, validate, ValidationError

# Database & Models
from src.db import db
from src.extention import bcrypt, jwt
from src.models import Student, Teacher, Admin, Course, # ...

# Services
from src.services import add_student, get_all_students, update_student, # ...

# Schemas
from src.schemas import RegisterStudentSchema, UpdateStudentSchema, # ...

# Environment
import os
from dotenv import load_dotenv

# LangChain/Graph (for agents)
from langchain_groq import ChatGroq
from langchain.tools import tool
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

# Typing
from typing import TypedDict, Annotated, Sequence
import operator
```

---

## 13. TIMEZONE HANDLING

Always use timezone-aware datetimes for consistency:

```python
from datetime import datetime
from zoneinfo import ZoneInfo

# In models
created_at = db.Column(db.DateTime, default=datetime.now(ZoneInfo("Asia/Karachi")))

# In services
new_entity.created_at = datetime.now(ZoneInfo("Asia/Karachi"))
```

---

## 14. CASCADING DELETES PATTERN

When deleting entities with relationships:

```python
def delete_course(course_id):
    course = Course.query.get(course_id)
    if not course:
        return jsonify({"message": "Course not found"}), 404
    
    # Delete related subjects first
    subjects = Subject.query.filter_by(course_id=course_id).all()
    subject_ids = [s.id for s in subjects]
    
    # Delete assignments under those subjects
    Assignment.query.filter(Assignment.subject_id.in_(subject_ids)).delete()
    
    # Delete submissions, results, attendance
    AssignmentSubmission.query.filter(...).delete()
    Result.query.filter(...).delete()
    Attendance.query.filter(...).delete()
    
    # Finally delete subjects and course
    Subject.query.filter_by(course_id=course_id).delete()
    db.session.delete(course)
    db.session.commit()
    
    return jsonify({"message": "Course deleted successfully"})
```

---

## 15. ENVIRONMENT VARIABLES

```
FLASK_DEBUG=true
PORT=5000
DATABASE_URI=mysql+pymysql://user:password@localhost/database_name
JWT_SECRET_KEY=your_secret_key_here
GROQ_API_KEY=your_groq_api_key
```

---

## Summary of Your Coding Style

Your Flask backend demonstrates:
- ✅ Clean separation of concerns (MVC-like layers)
- ✅ Consistent naming conventions throughout
- ✅ Robust error handling with HTTP status codes
- ✅ Security-first approach with JWT & role-based access
- ✅ Data validation using Marshmallow schemas
- ✅ Service-oriented architecture for reusability
- ✅ Integration with cutting-edge AI (LangGraph/LangChain)
- ✅ Timezone-aware datetime handling
- ✅ Environment-based configuration
- ✅ Cascading delete logic for data integrity

**This is a production-ready, maintainable codebase with clear patterns for scaling.**
