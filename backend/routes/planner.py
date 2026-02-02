from flask import Blueprint, request, jsonify
from models import db, Planner, Child

planner_bp = Blueprint("planner", __name__)


#Get all plans for a child
@planner_bp.route("/<int:child_id>", methods=["GET"])
def get_child_plans(child_id):
    # ✅ Check if child exists
    child = Child.query.get_or_404(child_id)

    plans = Planner.query.filter_by(child_id=child_id).all()
    result = [{
        "id": p.id,
        "task_name": p.task_name,
        "description": p.description,
        "date": p.date,
        "status": p.status
    } for p in plans]

    return jsonify(result)


#Add a new plan for a child
@planner_bp.route("/", methods=["POST"])
def add_plan():
    data = request.json

    #Check if child_id exists in Child table
    child = Child.query.get_or_404(data['child_id'])

    new_plan = Planner(
        child_id=data['child_id'],
        task_name=data['task_name'],
        description=data.get('description'),
        date=data.get('date'),
        status=data.get('status', 'Pending')
    )
    db.session.add(new_plan)
    db.session.commit()
    return jsonify({"message": "Plan added successfully", "id": new_plan.id}), 201


# Update plan status
@planner_bp.route("/<int:plan_id>", methods=["PATCH"])
def update_plan(plan_id):
    plan = Planner.query.get_or_404(plan_id)
    data = request.json
    plan.task_name = data.get("task_name", plan.task_name)
    plan.description = data.get("description", plan.description)
    plan.date = data.get("date", plan.date)
    plan.status = data.get("status", plan.status)
    db.session.commit()
    return jsonify({"message": "Plan updated successfully"})


# Delete a plan
@planner_bp.route("/<int:plan_id>", methods=["DELETE"])
def delete_plan(plan_id):
    plan = Planner.query.get_or_404(plan_id)
    db.session.delete(plan)
    db.session.commit()
    return jsonify({"message": "Plan deleted successfully"})
