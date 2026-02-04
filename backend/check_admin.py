from app import app, db
from models import User

with app.app_context():
    # Check if admin exists
    admin_email = "admin@grace-wise.com"
    admin = User.query.filter_by(email=admin_email).first()
    
    if admin:
        print(f"\n✓ Admin user already exists!")
        print(f"  Email: {admin.email}")
        print(f"  Is Admin: {admin.is_admin}")
        print(f"  First Name: {admin.first_name}")
    else:
        print("\nNo admin user found. The admin will be created when the app starts.")
