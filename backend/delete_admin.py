from app import AppUser, app, db


def main():
    username = input("Admin email to remove: ").strip().lower()
    with app.app_context():
        user = AppUser.query.filter_by(username=username).first()
        if not user:
            raise SystemExit("No account with that email.")
        if user.role != "ADMIN":
            raise SystemExit("This account is not an admin account.")
        if user.is_active and AppUser.query.filter_by(role="ADMIN", is_active=True).count() <= 1:
            raise SystemExit("This is the last active admin. Promote another admin first.")

        confirmation = input(f"Type '{username}' to permanently delete this admin: ").strip().lower()
        if confirmation != username:
            raise SystemExit("Deletion cancelled.")

        db.session.delete(user)
        db.session.commit()
    print("Admin account removed.")


if __name__ == "__main__":
    main()
