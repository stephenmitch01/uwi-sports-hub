(function () {
  "use strict";

  // Shared App Access
  /**
   * Account creation workflow.
   *
   * This public mutation creates the identity/profile bridge needed by the
   * signed-in app. Campus and role values are normalized again by the backend,
   * so frontend validation is guidance rather than authority.
   */
  const APP = window.UWISportsHub;
  const inviteStatus = document.getElementById("inviteStatus");
  const createAccountForm = document.getElementById("createAccountForm");
  const createAccountButton = document.getElementById("createAccountButton");
  const createAccountMessage = document.getElementById("createAccountMessage");

  document.addEventListener("DOMContentLoaded", function () {
    APP?.initNavToggle?.(document);
  });

  // URL Parameters
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("token");
  const inviteIsValid = Boolean(inviteToken && inviteToken.trim().length >= 8);

  if (inviteIsValid) {
    inviteStatus.textContent = "Invitation detected. You may complete account setup.";
    inviteStatus.classList.add("valid");
    createAccountButton.disabled = false;
  } else {
    window.location.href = "index.html";
  }

  createAccountForm?.addEventListener("submit", handleSubmit);

  // Save Workflow
  /**
   * Validates and persists the workflow payload through the shared API helper.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    APP?.clearMessage?.(createAccountMessage);

    if (!inviteIsValid) {
      APP?.showError?.(createAccountMessage, "A valid invite link is required before an account can be created.");
      return;
    }

    const payload = {
      fullName: document.getElementById("fullName")?.value.trim(),
      campus: document.getElementById("campus")?.value.trim(),
      email: document.getElementById("email")?.value.trim(),
      password: document.getElementById("password")?.value || "",
      confirmPassword: document.getElementById("confirmPassword")?.value || "",
      inviteToken,
      termsAccepted: Boolean(document.getElementById("termsCheck")?.checked)
    };

    if (!payload.fullName || !payload.campus || !payload.email || !payload.password || !payload.confirmPassword || !payload.termsAccepted) {
      APP?.showError?.(createAccountMessage, "Please complete all required fields.");
      return;
    }
    if (payload.password !== payload.confirmPassword) {
      APP?.showError?.(createAccountMessage, "Passwords do not match.");
      return;
    }

    createAccountButton.disabled = true;
    createAccountButton.textContent = "Creating...";

    try {
      const data = await APP.apiPost("/auth/create-account", payload, { redirectOn401: false });
      APP?.showSuccess?.(createAccountMessage, data?.message || "Account created successfully. You can now sign in.");
      createAccountForm.reset();
    } catch (error) {
      console.error(error);
      APP?.showError?.(createAccountMessage, error?.message || "Unable to connect to the server.");
    } finally {
      createAccountButton.disabled = !inviteIsValid;
      createAccountButton.textContent = "Create Account";
    }
  }
})();
