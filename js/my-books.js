// This is the bridge file for the Destiny face.
// After Firebase login is working, this page can use:
// window.lrcUser.email
// to match the student to Patron Barcode.

setTimeout(() => {
  const status = document.getElementById("studentStatus");
  const user = window.lrcUser;

  if (!status || !user) return;

  status.innerHTML = `
    <h2>Hello, ${user.displayName || "reader"}!</h2>
    <p>Your Google email is:</p>
    <p><strong>${user.email}</strong></p>
    <p>Next build step: connect this email to the Student Lookup Sheet.</p>
  `;
}, 800);
