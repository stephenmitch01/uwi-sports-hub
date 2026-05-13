(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const supportForm = document.getElementById("supportForm");
  const supportMessageBox = document.getElementById("supportMessageBox");
  const supportTopic = document.getElementById("supportTopic");
  const supportMessage = document.getElementById("supportMessage");
  const supportSubmitButton = supportForm ? supportForm.querySelector('button[type="submit"]') : null;

  function campusLabel(session) {
    if (!session?.campus) return "";
    return APP?.getCampusMeta?.(session.campus)?.name || session.campus;
  }

  function fillAccountContext(session) {
    const supportName = document.getElementById("supportName");
    const supportEmail = document.getElementById("supportEmail");
    const supportCampus = document.getElementById("supportCampus");

    if (supportName) supportName.value = session?.fullName || "";
    if (supportEmail) supportEmail.value = session?.email || "";
    if (supportCampus) supportCampus.value = campusLabel(session);
  }

  function setSubmitting(isSubmitting) {
    if (!supportSubmitButton) return;
    supportSubmitButton.disabled = isSubmitting;
    supportSubmitButton.textContent = isSubmitting ? "Submitting..." : "Submit Support Request";
  }

  document.addEventListener("DOMContentLoaded", async function () {
    try {
      const session = await APP?.mountSignedInShell?.({ active: "support", contextLabel: "Support" });
      if (!session) return;

      fillAccountContext(session);
      if (!supportForm) return;

      supportForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        APP.clearMessage?.(supportMessageBox);

        const topic = supportTopic?.value.trim() || "";
        const message = supportMessage?.value.trim() || "";

        if (!topic || !message) {
          APP.showError?.(supportMessageBox, "Please complete the topic and message fields before submitting.");
          return;
        }

        const payload = {
          userId: session.id || null,
          name: session.fullName || "",
          email: session.email || "",
          campus: session.campus || "",
          topic,
          message
        };

        setSubmitting(true);
        try {
          await APP.apiPost("/support-requests", payload, { redirectOn401: true });
          APP.showSuccess?.(supportMessageBox, `Support request saved for review from ${payload.email} (${campusLabel(session)}).`);
          if (supportTopic) supportTopic.value = "";
          if (supportMessage) supportMessage.value = "";
        } catch (error) {
          console.error("Support request submission error:", error);
          APP.showError?.(supportMessageBox, error?.message || "Unable to submit your support request right now.");
        } finally {
          setSubmitting(false);
        }
      });
    } catch (error) {
      console.error("Support page init error:", error);
      APP.showError?.(supportMessageBox, error?.message || "Unable to load support right now.");
    }
  });
})();
