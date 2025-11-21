// === CONFIG ===
// If you ever redeploy your Apps Script and the URL changes, update this:
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxEx6RHLgRhy1bZw79qPeo8bdaJLKXVEqGMXLoniAKNAaDhBq_uRrfA8fpAdvPJfozy/exec";

// --- Local storage helpers ---

function saveStudentInfo({ student_id, name, className }) {
  localStorage.setItem('ra_student_id', student_id);
  localStorage.setItem('ra_name', name || '');
  localStorage.setItem('ra_class', className || '');
}

function getStudentInfo() {
  return {
    student_id: localStorage.getItem('ra_student_id'),
    name: localStorage.getItem('ra_name'),
    className: localStorage.getItem('ra_class'),
  };
}

function clearStudentInfo() {
  localStorage.removeItem('ra_student_id');
  localStorage.removeItem('ra_name');
  localStorage.removeItem('ra_class');
}

// --- API helper ---

async function callApi(action, payload) {
  const body = { action, ...payload };

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // If something goes wrong, this will throw
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  const data = await res.json();
  return data;
}

// --- Page init ---

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const sabotageForm = document.getElementById('sabotage-form');
  const prizeForm = document.getElementById('prize-form');
  const refreshBtn = document.getElementById('refresh-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const studentLabel = document.getElementById('student-label');
  const statusEl = document.getElementById('status');

  const minutesEl = document.getElementById('minutes-total');
  const coinsEl = document.getElementById('coins-total');
  const pointsEl = document.getElementById('points-total');

  // Helper to show messages at bottom of dashboard
  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#b91c1c' : '#111827';
  }

  // --- LOGIN PAGE LOGIC (index.html) ---
  if (loginForm) {
    const loginMessage = document.getElementById('login-message');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginMessage.textContent = 'Checking your portal...';

      const student_id = document.getElementById('student_id').value.trim();
      const name = document.getElementById('name').value.trim();
      const className = document.getElementById('className').value.trim();

      if (!student_id || !name || !className) {
        loginMessage.textContent = 'Please fill in all fields.';
        return;
      }

      try {
        const data = await callApi('login', {
          student_id,
          name,
          className,
        });

        if (!data.success) {
          loginMessage.textContent = data.message || 'Login problem. Try again.';
          return;
        }

        // Save what the server sends back (in case name/class changed)
        saveStudentInfo({
          student_id: data.student_id,
          name: data.name || name,
          className: data.className || className,
        });

        // Go to dashboard
        window.location.href = 'dashboard.html';
      } catch (err) {
        console.error(err);
        loginMessage.textContent = 'There was an error talking to the Read-a-Thon server.';
      }
    });

    return; // stop here if we’re on the login page
  }

  // --- DASHBOARD PAGE LOGIC (dashboard.html) ---
  // If we got here, we're on dashboard.html because there's no loginForm

  const { student_id, name, className } = getStudentInfo();

  // If no student info, send them back to login
  if (!student_id) {
    window.location.href = 'index.html';
    return;
  }

  // Fill in greeting
  if (studentLabel) {
    const displayName = name || 'Reader';
    const displayClass = className || '';
    studentLabel.textContent = displayClass
      ? `Hi, ${displayName} from ${displayClass}!`
      : `Hi, ${displayName}!`;
  }

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearStudentInfo();
      window.location.href = 'index.html';
    });
  }

  // Load stats from server
  async function loadStats() {
    if (!minutesEl || !coinsEl || !pointsEl) return;

    setStatus('Loading your totals...');
    try {
      const data = await callApi('getStats', { student_id });

      if (!data.success) {
        minutesEl.textContent = '0';
        coinsEl.textContent = '0';
        pointsEl.textContent = '0';
        setStatus(data.message || 'Could not find your totals yet.');
        return;
      }

      minutesEl.textContent = data.minutes_total ?? 0;
      coinsEl.textContent = data.coins_total ?? 0;
      pointsEl.textContent = data.total_points ?? 0;

      // Update stored name/class if they exist
      saveStudentInfo({
        student_id: data.student_id,
        name: data.name || name,
        className: data.className || className,
      });

      setStatus('Totals updated!');
    } catch (err) {
      console.error(err);
      setStatus('There was an error loading your totals.', true);
    }
  }

  // Initial load
  loadStats();

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loadStats();
    });
  }

  // --- Sabotage form (sabotageRequest) ---
  if (sabotageForm) {
    sabotageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus('Sending sabotage request...');

      const target_class = document.getElementById('sabotage-target').value;
      const amountStr = document.getElementById('sabotage-amount').value;
      const minutes_spent = Number(amountStr);

      if (!target_class || !minutes_spent || minutes_spent <= 0) {
        setStatus('Please pick a class and enter minutes greater than 0.', true);
        return;
      }

      try {
        const data = await callApi('sabotageRequest', {
          student_id,
          name,
          className,
          target_class,
          minutes_spent,
        });

        if (!data.success) {
          setStatus(data.message || 'There was a problem sending your sabotage.', true);
          return;
        }

        setStatus('Sabotage request sent! Your teacher will review it. 😈');
        sabotageForm.reset();
      } catch (err) {
        console.error(err);
        setStatus('There was an error sending your sabotage request.', true);
      }
    });
  }

  // --- Prize form (prizeRequest) ---
  if (prizeForm) {
    prizeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus('Sending prize request...');

      const prize_item = document.getElementById('prize-item').value;
      const pointsStr = document.getElementById('prize-points').value;
      const points_requested = Number(pointsStr);

      if (!prize_item || !points_requested || points_requested <= 0) {
        setStatus('Please pick a prize and enter points greater than 0.', true);
        return;
      }

      try {
        const data = await callApi('prizeRequest', {
          student_id,
          name,
          className,
          prize_item,
          points_requested,
        });

        if (!data.success) {
          setStatus(data.message || 'There was a problem sending your prize request.', true);
          return;
        }

        setStatus('Prize request sent! Your teacher will check your points and deliver prizes later. 🎁');
        prizeForm.reset();
      } catch (err) {
        console.error(err);
        setStatus('There was an error sending your prize request.', true);
      }
    });
  }
});
