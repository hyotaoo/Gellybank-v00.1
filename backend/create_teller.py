from getpass import getpass

from app import AppUser, app, db, hash_password, utcnow, validate_password


def main():
    username = input("Teller email: ").strip().lower()
    if "@" not in username or "." not in username:
        raise SystemExit("Enter a valid teller email address.")

    password = getpass("Teller password (8+ characters, including a letter and number): ")
    confirmation = getpass("Confirm teller password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")
    message, code = validate_password(password)
    if message:
        raise SystemExit(message)
    with app.app_context():
        if AppUser.query.filter_by(username=username).first():
            raise SystemExit("An account with that email already exists.")
        db.session.add(AppUser(
            username=username,
            password_hash=hash_password(password),
            role="TELLER",
            email_verified_at=utcnow(),
        ))
        db.session.commit()
    print("Teller account created.")


if __name__ == "__main__":
    main()
