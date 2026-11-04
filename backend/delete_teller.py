from app import AccountApplication, AppUser, app, db


def main():
    username = input("Teller email to remove: ").strip().lower()
    with app.app_context():
        user = AppUser.query.filter_by(username=username).first()
        if not user:
            raise SystemExit("No account with that email.")
        if user.role != "TELLER":
            raise SystemExit("This account is not a teller account.")
        if user.customer_id is not None:
            raise SystemExit("This teller is linked to a customer profile. Suspend it instead.")
        if AccountApplication.query.filter_by(applicant_user_id=user.user_id).first():
            raise SystemExit("This teller has linked account applications. Suspend it instead.")

        confirmation = input(f"Type '{username}' to permanently delete this teller: ").strip().lower()
        if confirmation != username:
            raise SystemExit("Deletion cancelled.")

        db.session.delete(user)
        db.session.commit()
    print("Teller account removed.")


if __name__ == "__main__":
    main()
