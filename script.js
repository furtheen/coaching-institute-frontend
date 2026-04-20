const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navAnchors = document.querySelectorAll(".nav-links a");
const enrollForm = document.querySelector("#enrollForm");
const courseSelect = document.querySelector("#course");
const priceDisplay = document.querySelector("#priceDisplay");
const paymentModal = document.querySelector("#paymentModal");
const paymentModalTitle = document.querySelector("#paymentModalTitle");
const paymentModalText = document.querySelector("#paymentModalText");
const previewButtons = document.querySelectorAll(".preview-btn");
const videoModal = document.querySelector("#videoModal");
const videoFrame = document.querySelector("#videoFrame");
const videoCloseBtn = document.querySelector("#videoCloseBtn");
const videoStatus = document.querySelector("#videoStatus");
const videoFallbackLink = document.querySelector("#videoFallbackLink");
const courseCards = document.querySelectorAll(".course-card");
let videoFallbackTimer = null;
let courseCatalog = [];
let resolvedApiBaseUrl = "";

const API_CANDIDATE_URLS = [
  window.API_BASE_URL || "",
  "http://localhost:5000",
  "http://localhost:5050",
  "http://localhost:5051",
  "http://localhost:5157",
  "http://localhost:5257",
  "https://localhost:7000",
  "https://localhost:7001",
  "https://localhost:7157",
  "https://localhost:7257",
].filter(Boolean);

function normalizeCourseName(value) {
  return (value || "")
    .toLowerCase()
    .replace("&", "and")
    .replace(/\s+/g, " ")
    .trim();
}

function formatIndianCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function getCourseById(courseId) {
  return courseCatalog.find((course) => course.id === Number(courseId));
}

function getCourseByName(courseName) {
  const normalized = normalizeCourseName(courseName);
  return courseCatalog.find((course) => {
    const apiName = normalizeCourseName(course.name);
    if (apiName === normalized) return true;
    if (normalized.includes("machine learning") && apiName.includes("artificial intelligence")) return true;
    if (normalized.includes("artificial intelligence") && apiName.includes("machine learning")) return true;
    return false;
  });
}

async function resolveApiBaseUrl() {
  if (resolvedApiBaseUrl) return resolvedApiBaseUrl;

  for (const candidate of API_CANDIDATE_URLS) {
    try {
      const response = await fetch(`${candidate}/api/courses`, { method: "GET" });
      if (response.ok) {
        resolvedApiBaseUrl = candidate;
        return resolvedApiBaseUrl;
      }
    } catch (_error) {
      // Try next candidate
    }
  }

  throw new Error(
    "Unable to connect to backend API. Start backend and set window.API_BASE_URL in HTML if needed."
  );
}

async function apiRequest(path, options = {}) {
  const baseUrl = await resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Request failed.";
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (_error) {
      // Keep generic message
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("is-open");
    menuToggle.classList.toggle("is-active");
  });
}

navAnchors.forEach((anchor) => {
  anchor.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    menuToggle.classList.remove("is-active");
  });
});

function updatePriceFromCourse() {
  if (!courseSelect || !priceDisplay) return;
  const selectedCourse = getCourseById(courseSelect.value);
  priceDisplay.textContent = selectedCourse ? formatIndianCurrency(selectedCourse.price) : "₹0";
}

function getSelectedCourseFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const courseIdParam = params.get("courseId");
  if (courseIdParam && getCourseById(courseIdParam)) {
    return getCourseById(courseIdParam);
  }

  const courseNameParam = params.get("course");
  if (courseNameParam) {
    return getCourseByName(courseNameParam);
  }

  return null;
}

function populateCourseSelect() {
  if (!courseSelect) return;

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select Course";
  courseSelect.innerHTML = "";
  courseSelect.appendChild(defaultOption);

  courseCatalog.forEach((course) => {
    const option = document.createElement("option");
    option.value = String(course.id);
    option.textContent = course.name;
    courseSelect.appendChild(option);
  });

  const selectedCourse = getSelectedCourseFromQuery();
  if (selectedCourse) {
    courseSelect.value = String(selectedCourse.id);
  }

  updatePriceFromCourse();
}

function syncIndexCardsWithApi() {
  if (!courseCards.length || !courseCatalog.length) return;

  courseCards.forEach((card) => {
    const title = card.querySelector("h3")?.textContent?.trim() || "";
    const matchedCourse = getCourseByName(title);
    if (!matchedCourse) return;

    const seatsElement = card.querySelector(".seats-left");
    const priceElement = card.querySelector(".price-tag");
    const enrollLink = card.querySelector('a[href*="enroll.html"]');

    if (seatsElement) {
      seatsElement.textContent = `Only ${matchedCourse.seatsAvailable} seats left`;
    }
    if (priceElement) {
      priceElement.textContent = formatIndianCurrency(matchedCourse.price);
    }
    if (enrollLink) {
      enrollLink.href = `enroll.html?courseId=${matchedCourse.id}`;
    }
  });
}

async function loadCoursesFromApi() {
  const courses = await apiRequest("/api/courses");
  courseCatalog = Array.isArray(courses) ? courses : [];

  populateCourseSelect();
  syncIndexCardsWithApi();
}

if (courseSelect) {
  loadCoursesFromApi().catch((error) => {
    if (priceDisplay) {
      priceDisplay.textContent = "Backend not connected";
    }
    // eslint-disable-next-line no-console
    console.error(error.message);
  });
  courseSelect.addEventListener("change", updatePriceFromCourse);
}

if (courseCards.length) {
  loadCoursesFromApi().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error.message);
  });
}

if (enrollForm && paymentModal) {
  enrollForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    updatePriceFromCourse();

    if (paymentModalTitle && paymentModalText) {
      paymentModalTitle.textContent = "Creating enrollment...";
      paymentModalText.textContent = "Please wait while we save your details.";
    }

    paymentModal.classList.add("is-open");
    paymentModal.setAttribute("aria-hidden", "false");

    const name = document.querySelector("#name")?.value?.trim();
    const email = document.querySelector("#email")?.value?.trim();
    const courseId = Number(courseSelect?.value);

    if (!name || !email || !courseId) {
      if (paymentModalTitle && paymentModalText) {
        paymentModalTitle.textContent = "Missing details";
        paymentModalText.textContent = "Please fill all fields before payment.";
      }
      return;
    }

    try {
      const enrollmentResponse = await apiRequest("/api/enroll", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          courseId,
        }),
      });

      const enrollmentId = enrollmentResponse?.enrollment?.id;
      if (!enrollmentId) {
        throw new Error("Enrollment created, but no enrollment id received.");
      }

      if (paymentModalTitle && paymentModalText) {
        paymentModalTitle.textContent = "Processing payment...";
        paymentModalText.textContent = "Simulating secure payment confirmation.";
      }

      await apiRequest("/api/payment/create-order", {
        method: "POST",
        body: JSON.stringify({
          enrollmentId,
          amount: priceDisplayValue
        }),
      });

      if (paymentModalTitle && paymentModalText) {
        paymentModalTitle.textContent = "Payment Successful ✅";
        paymentModalText.textContent =
          "Your enrollment is confirmed and payment status is updated to Paid.";
      }

      enrollForm.reset();
      updatePriceFromCourse();
      await loadCoursesFromApi();
    } catch (error) {
      if (paymentModalTitle && paymentModalText) {
        paymentModalTitle.textContent = "Payment Failed";
        paymentModalText.textContent =
          error instanceof Error ? error.message : "Something went wrong. Try again.";
      }
    }

    window.setTimeout(() => {
      paymentModal.classList.remove("is-open");
      paymentModal.setAttribute("aria-hidden", "true");
    }, 3400);
  });
}

function closeVideoModal() {
  if (!videoModal || !videoFrame) return;
  videoModal.classList.remove("is-open");
  videoModal.setAttribute("aria-hidden", "true");
  videoFrame.src = "";
  if (videoFallbackLink) {
    videoFallbackLink.classList.add("is-hidden");
  }
  if (videoStatus) {
    videoStatus.textContent = "Loading preview...";
  }
  if (videoFallbackTimer) {
    window.clearTimeout(videoFallbackTimer);
    videoFallbackTimer = null;
  }
}

function getYouTubeVideoId(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const host = parsed.hostname.replace("www.", "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/embed/")[1];
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/shorts/")[1];
      }
    }

    if (host === "youtu.be") {
      return parsed.pathname.replace("/", "");
    }
  } catch (_error) {
    return "";
  }

  return "";
}

function buildVideoLinks(rawVideoUrl) {
  const videoId = getYouTubeVideoId(rawVideoUrl);

  if (videoId) {
    return {
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  return { embedUrl: rawVideoUrl, watchUrl: rawVideoUrl };
}

if (previewButtons.length && videoModal && videoFrame) {
  previewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const videoUrl = button.getAttribute("data-video");
      if (!videoUrl) return;
      const { embedUrl, watchUrl } = buildVideoLinks(videoUrl);

      if (videoFallbackLink) {
        videoFallbackLink.href = watchUrl;
        videoFallbackLink.classList.add("is-hidden");
      }

      if (videoStatus) {
        videoStatus.textContent = "Loading preview...";
      }

      videoModal.classList.add("is-open");
      videoModal.setAttribute("aria-hidden", "false");

      videoFrame.src = "";
      window.setTimeout(() => {
        videoFrame.src = `${embedUrl}?autoplay=1&rel=0`;
      }, 500);

      if (videoFallbackTimer) {
        window.clearTimeout(videoFallbackTimer);
      }
      videoFallbackTimer = window.setTimeout(() => {
        if (videoStatus) {
          videoStatus.textContent = "Preview blocked by provider. Open on YouTube instead.";
        }
        if (videoFallbackLink) {
          videoFallbackLink.classList.remove("is-hidden");
        }
      }, 3200);
    });
  });
}

if (videoCloseBtn) {
  videoCloseBtn.addEventListener("click", closeVideoModal);
}

if (videoModal) {
  videoModal.addEventListener("click", (event) => {
    if (event.target === videoModal) {
      closeVideoModal();
    }
  });
}

if (videoFrame) {
  videoFrame.addEventListener("load", () => {
    if (videoFallbackTimer) {
      window.clearTimeout(videoFallbackTimer);
      videoFallbackTimer = null;
    }
    if (videoStatus) {
      videoStatus.textContent = "Preview ready.";
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeVideoModal();
  }
});
