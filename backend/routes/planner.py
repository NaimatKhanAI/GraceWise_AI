from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from models import db, Planner, Child
from utils.access_control import tier_required

planner_bp = Blueprint("planner", __name__)


# Get all plans for a child
@planner_bp.route("/<int:child_id>", methods=["GET"])
@tier_required("plan")
def get_child_plans(child_id):
    # ✅ Check if child exists
    child = Child.query.get_or_404(child_id)

    plans = Planner.query.filter_by(child_id=child_id).order_by(Planner.date, Planner.start_time).all()
    result = [{
        "id": p.id,
        "task_name": p.task_name,
        "description": p.description,
        "date": p.date,
        "start_time": p.start_time,
        "end_time": p.end_time,
        "subject": p.subject,
        "subtitle": p.subtitle,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None
    } for p in plans]

    return jsonify(result)


# Get plans for a specific date range
@planner_bp.route("/<int:child_id>/range", methods=["GET"])
@tier_required("plan")
def get_plans_by_range(child_id):
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    child = Child.query.get_or_404(child_id)
    
    query = Planner.query.filter_by(child_id=child_id)
    
    if start_date and end_date:
        query = query.filter(Planner.date >= start_date, Planner.date <= end_date)
    
    plans = query.order_by(Planner.date, Planner.start_time).all()
    
    result = [{
        "id": p.id,
        "task_name": p.task_name,
        "description": p.description,
        "date": p.date,
        "start_time": p.start_time,
        "end_time": p.end_time,
        "subject": p.subject,
        "subtitle": p.subtitle,
        "status": p.status
    } for p in plans]

    return jsonify(result)


# Add a new plan for a child
@planner_bp.route("/", methods=["POST"])
@tier_required("plan")
def add_plan():
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Check if child_id exists
        if 'child_id' not in data:
            return jsonify({"error": "child_id is required"}), 400
            
        child = Child.query.get(data['child_id'])
        if not child:
            return jsonify({"error": "Child not found"}), 404

        new_plan = Planner(
            child_id=data['child_id'],
            task_name=data.get('task_name', ''),
            description=data.get('description'),
            date=data.get('date'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            subject=data.get('subject'),
            subtitle=data.get('subtitle'),
            status=data.get('status', 'Pending')
        )
        db.session.add(new_plan)
        db.session.commit()
        return jsonify({"message": "Plan added successfully", "id": new_plan.id}), 201
    except KeyError as e:
        db.session.rollback()
        return jsonify({"error": f"Missing required field: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error adding plan: {str(e)}")
        return jsonify({"error": f"Failed to add plan: {str(e)}"}), 500


# Update a plan
@planner_bp.route("/<int:plan_id>", methods=["PATCH"])
@tier_required("plan")
def update_plan(plan_id):
    try:
        plan = Planner.query.get(plan_id)
        if not plan:
            return jsonify({"error": "Plan not found"}), 404
            
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        plan.task_name = data.get("task_name", plan.task_name)
        plan.description = data.get("description", plan.description)
        plan.date = data.get("date", plan.date)
        plan.start_time = data.get("start_time", plan.start_time)
        plan.end_time = data.get("end_time", plan.end_time)
        plan.subject = data.get("subject", plan.subject)
        plan.subtitle = data.get("subtitle", plan.subtitle)
        plan.status = data.get("status", plan.status)
        
        db.session.commit()
        return jsonify({"message": "Plan updated successfully"})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating plan: {str(e)}")
        return jsonify({"error": f"Failed to update plan: {str(e)}"}), 500


# Delete a plan
@planner_bp.route("/<int:plan_id>", methods=["DELETE"])
@tier_required("plan")
def delete_plan(plan_id):
    try:
        plan = Planner.query.get(plan_id)
        if not plan:
            return jsonify({"error": "Plan not found"}), 404
            
        db.session.delete(plan)
        db.session.commit()
        return jsonify({"message": "Plan deleted successfully"})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting plan: {str(e)}")
        return jsonify({"error": f"Failed to delete plan: {str(e)}"}), 500
