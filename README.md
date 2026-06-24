# LRC Quest Google Login Starter

This starter creates the front door for LRC Quest.

## Pages included
- `index.html` — Google sign-in page
- `dashboard.html` — protected LRC Quest home
- `destiny/catalog.html` — protected Find a Book page
- `destiny/my-books.html` — protected My Books page
- `destiny/check-in-out.html` — protected Check In / Out page

## What works after Firebase setup
- Students sign in with Google
- Dashboard only opens if signed in
- Destiny pages already know the signed-in Google account
- My Books page displays the signed-in student's Google email

## Firebase setup
1. Go to Firebase Console.
2. Create or open your LRC Quest project.
3. Add a Web App.
4. Copy the Firebase config.
5. Paste it into `js/firebase-config.js`.
6. In Firebase Authentication, enable Google as a sign-in provider.
7. Add your website domain under authorized domains.

## Next build step
Connect:
Google Email → Patron Barcode → Destiny Current Checkouts/Fines export

Use the templates in `data_imports`.
