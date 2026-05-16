document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupLocked = document.getElementById("signup-locked");
  const authToggle = document.getElementById("auth-toggle");
  const authMenu = document.getElementById("auth-menu");
  const authSummary = document.getElementById("auth-summary");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const authMessage = document.getElementById("auth-message");
  const messageDiv = document.getElementById("message");

  const staffRoles = new Set(["club_admin", "federation_admin"]);
  let currentUser = { authenticated: false, role: "student" };

  function isStaff() {
    return currentUser.authenticated && staffRoles.has(currentUser.role);
  }

  function roleLabel(role) {
    const labels = {
      student: "student",
      club_admin: "club admin",
      federation_admin: "federation admin",
    };

    return labels[role] || role;
  }

  function showMessage(element, text, type) {
    element.textContent = text;
    element.className = type;
    element.classList.remove("hidden");

    setTimeout(() => {
      element.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    authSummary.textContent = currentUser.authenticated
      ? `Signed in as ${currentUser.username} (${roleLabel(currentUser.role)})`
      : "Signed out as student";

    authToggle.textContent = currentUser.authenticated
      ? roleLabel(currentUser.role)
      : "Log in";

    loginForm.classList.toggle("hidden", currentUser.authenticated);
    logoutButton.classList.toggle("hidden", !currentUser.authenticated);
    signupForm.classList.toggle("hidden", !isStaff());
    signupLocked.classList.toggle("hidden", isStaff());
  }

  async function loadSession() {
    const response = await fetch("/me");
    const user = await response.json();
    currentUser = user.authenticated ? user : { authenticated: false, role: "student" };
    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const staffParticipantsHTML = `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`;

        const studentParticipantsHTML = `<div class="participants-section">
              <h5>Participants:</h5>
              <p><em>${details.participants.length} student(s) registered</em></p>
            </div>`;

        const participantsHTML =
          details.participants.length > 0
            ? isStaff()
              ? staffParticipantsHTML
              : studentParticipantsHTML
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        if (isStaff()) {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          activitySelect.appendChild(option);
        }
      });

      // Add event listeners to delete buttons
      if (isStaff()) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isStaff()) {
      showMessage(messageDiv, "Teacher access required.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(messageDiv, result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage(messageDiv, "Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isStaff()) {
      showMessage(messageDiv, "Teacher access required.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage(messageDiv, "Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  authToggle.addEventListener("click", () => {
    authMenu.classList.toggle("hidden");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(authMessage, result.detail || "Login failed", "error");
        return;
      }

      currentUser = result;
      updateAuthUI();
      loginForm.reset();
      showMessage(authMessage, `Logged in as ${username} (${roleLabel(currentUser.role)})`, "success");
      await fetchActivities();
    } catch (error) {
      showMessage(authMessage, "Unable to log in right now.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/logout", { method: "POST" });
      const result = await response.json();
      currentUser = result;
      updateAuthUI();
      showMessage(authMessage, "Logged out.", "success");
      await fetchActivities();
    } catch (error) {
      showMessage(authMessage, "Unable to log out right now.", "error");
      console.error("Error logging out:", error);
    }
  });

  // Initialize app
  loadSession().then(fetchActivities);
});
