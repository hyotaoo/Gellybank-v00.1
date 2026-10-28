from getpass import getpass

from app import AppUser, app, db, hash_password


def main():
    username = input("Admin email: ").strip().lower()
    if "@" not in username or "." not in username:
        raise SystemExit("Enter a valid admin email address.")

    password = getpass("Admin password (8+ characters, including a letter and number): ")
    confirmation = getpass("Confirm admin password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")
    if len(password) < 8 or not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        raise SystemExit("Password needs 8+ characters with a letter and a number.")

    with app.app_context():
        if AppUser.query.filter_by(username=username).first():
            raise SystemExit("An account with that email already exists.")
        db.session.add(AppUser(
            username=username,
            password_hash=hash_password(password),
            role="ADMIN",
        ))
        db.session.commit()
    print("Admin account created.")


if __name__ == "__main__":
    main()
