from app import app, db
from models import User

with app.app_context():
    admin = User.query.filter_by(email="admin@grace-wise.com").first()
    
    if admin:
        print(f"\n✓ Admin user exists!")
        print(f"  Email: {admin.email}")
        print(f"  First Name: {admin.first_name}")
        print(f"  Is Admin: {admin.is_admin}")
        print(f"  Is Active: {admin.is_active}")
        print(f"  ID: {admin.id}")
    else:
        print("\n✗ Admin user not found!")
        print("Creating admin user now...")
        
        admin = User(
            first_name="Admin",
            last_name="User",
            email="admin@grace-wise.com",
            is_admin=True
        )
        admin.set_password("grace.admin@123")
        db.session.add(admin)
        db.session.commit()
        
        print(f"\n✓ Admin user created!")
        print(f"  Email: {admin.email}")
        print(f"  Is Admin: {admin.is_admin}")
