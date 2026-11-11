from getpass import getpass

from app import (
    AppUser,
    app,
    db,
    hash_password,
    record_password_history,
    utcnow,
    validate_password,
)


def main():
    username = input("Admin email: ").strip().lower()
    if "@" not in username or "." not in username:
        raise SystemExit("Enter a valid admin email address.")

    password = getpass(
        "Admin password (8+ characters with uppercase, lowercase, a number, "
        "a special character, no spaces): "
    )
    confirmation = getpass("Confirm admin password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")
    message, code = validate_password(password, username)
    if message:
        raise SystemExit(message)
    with app.app_context():
        if AppUser.query.filter_by(username=username).first():
            raise SystemExit("An account with that email already exists.")
        user = AppUser(
            username=username,
            password_hash=hash_password(password),
            role="ADMIN",
            email_verified_at=utcnow(),
        )
        db.session.add(user)
        db.session.flush()
        record_password_history(user)
        db.session.commit()
    print("Admin account created.")


if __name__ == "__main__":
    main()
