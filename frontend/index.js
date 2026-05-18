(function () {
  "use strict";

  /**
   * Public sign-in workflow.
   *
   * Public pages do not mount the signed-in shell. Successful authentication is
   * delegated to the backend session endpoint, after which signed-in pages load
   * campus and role information through `mountSignedInShell`.
   */
  const APP = window.UWISportsHub;

  const signInForm = document.getElementById("signInForm");
  const signInMessage = document.getElementById("signInMessage");
  const signInBtn = document.getElementById("signInBtn");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  document.addEventListener("DOMContentLoaded", function () {
    APP?.initNavToggle?.(document);
    checkExistingSession();
  });

  if (signInForm) {
    signInForm.addEventListener("submit", handleSignIn);
  }

  async function checkExistingSession() {
    try {
      const data = await APP.apiGet(`/auth/session`, true);
      if (data && (data.isAuthenticated || data.user || data.session)) {
        window.location.href = "dashboard.html";
      }
    } catch (error) {
      console.warn("Session check skipped.", error);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    APP?.clearMessage?.(signInMessage);

    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";

    if (!email || !password) {
      APP?.showError?.(signInMessage, "Please complete all required fields.");
      return;
    }

    setLoading(true);

    try {
      await APP.apiPost("/auth/login", { email, password }, { redirectOn401: false });
      APP?.showSuccess?.(signInMessage, "Sign-in successful. Redirecting...");
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("Sign-in error:", error);
      APP?.showError?.(signInMessage, error?.message || "Unable to connect to the server.");
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    if (!signInBtn) return;
    signInBtn.disabled = isLoading;
    signInBtn.textContent = isLoading ? "Signing In..." : "Sign In";
  }
})();
