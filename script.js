const navbar = document.getElementById("navbar");
const navToggle = document.getElementById("navToggle");
const navMenu = document.getElementById("navMenu");
const navLinks = navMenu ? navMenu.querySelectorAll("a") : [];
const bgm = document.getElementById("bgm");
const bgVideoEl = document.querySelector(".bg-video video");
const musicToggle = document.getElementById("musicToggle");
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

if (bgm) {
  const MUSIC_VOLUME = 0.45;
  bgm.volume = MUSIC_VOLUME;
  bgm.preload = "auto";

  const preloadSrc = (bgm.currentSrc || bgm.getAttribute("src") || "music.mp3").trim();
  if (preloadSrc) {
    fetch(preloadSrc, { cache: "force-cache" }).catch(() => {
      // Ignore preload fetch errors; media element preload continues independently.
    });
  }

  bgm.load();

  // Attempt immediate playback at script init (browser may respect this timing).
  (function earlyPlayAttempt() {
    if (bgm.paused) {
      bgm.play().catch(() => {
        // Expected if browser blocks - will retry on lifecycle + unlock events.
      });
    }
  })();

  // Force default ON for every fresh page open.
  let wantsMusic = true;
  const MAX_AUTOSTART_TRIES = 18;
  let autoStartTryCount = 0;
  let autoStartTimer = null;
  let musicGateEl = null;

  const tryUnmuteBootstrapAudio = () => {
    if (!wantsMusic || bgm.paused || !bgm.muted) return;

    bgm.muted = false;
    bgm.volume = MUSIC_VOLUME;
    bgm.play().catch(() => {
      // If browser still blocks audible playback, keep muted bootstrap running.
      bgm.muted = true;
    });
  };

  const setMusicButtonState = () => {
    if (!musicToggle) return;
    const isPlaying = !bgm.paused;
    musicToggle.textContent = isPlaying ? "Music: On" : "Music: Off";
    musicToggle.setAttribute("aria-pressed", String(isPlaying));
  };

  const clearAutoStartTimer = () => {
    if (!autoStartTimer) return;
    window.clearTimeout(autoStartTimer);
    autoStartTimer = null;
  };

  const hideMusicGate = () => {
    if (!musicGateEl) return;
    musicGateEl.remove();
    musicGateEl = null;
  };

  const showMusicGate = () => {
    if (!isTouchDevice || musicGateEl || !wantsMusic || !bgm.paused) return;

    musicGateEl = document.createElement("div");
    musicGateEl.className = "music-gate";
    musicGateEl.innerHTML = `
      <div class="music-gate-card">
        <p class="music-gate-title">Enable Background Music</p>
        <button type="button" class="music-gate-btn" aria-label="Tap to start background music">Tap To Start Music</button>
      </div>
    `;

    const gateBtn = musicGateEl.querySelector(".music-gate-btn");
    gateBtn.addEventListener("click", () => {
      wantsMusic = true;
      autoStartTryCount = 0;
      startMedia().then((started) => {
        if (started) {
          hideMusicGate();
        }
      });
    });

    document.body.appendChild(musicGateEl);
  };

  const startMedia = () => {
    if (bgVideoEl) {
      bgVideoEl.play().catch(() => {
        // Ignore - browser may still be initializing media.
      });
    }

    if (!wantsMusic) {
      setMusicButtonState();
      return Promise.resolve(false);
    }

    // Ensure audible volume and unmuted for playback.
    bgm.muted = false;
    bgm.volume = MUSIC_VOLUME;

    return bgm.play().then(() => {
      setMusicButtonState();
      clearAutoStartTimer();
      hideMusicGate();
      return true;
    }).catch(() => {
      // Fallback: browser may have blocked audible autoplay.
      // Try muted bootstrap if still paused.
      if (bgm.paused) {
        bgm.muted = true;
        return bgm.play().then(() => {
          setMusicButtonState();
          window.setTimeout(tryUnmuteBootstrapAudio, 100);
          return true;
        }).catch(() => {
          // Full block: wait for user interaction.
          setMusicButtonState();
          showMusicGate();
          return false;
        });
      }
      return false;
    });
  };

  const scheduleAutoStartRetry = (delayMs = 220) => {
    if (!wantsMusic || !bgm.paused || autoStartTryCount >= MAX_AUTOSTART_TRIES) return;
    clearAutoStartTimer();
    autoStartTimer = window.setTimeout(() => {
      autoStartTryCount += 1;
      startMedia().then((started) => {
        if (!started && wantsMusic && bgm.paused) {
          scheduleAutoStartRetry(320);
        }
      });
    }, delayMs);
  };

  const tryStartOnLifecycle = () => {
    startMedia().then((started) => {
      if (!started && wantsMusic && bgm.paused) {
        scheduleAutoStartRetry();
        showMusicGate();
      }
    });
  };

  // Try across common lifecycle points for better browser/device coverage.
  document.addEventListener("DOMContentLoaded", tryStartOnLifecycle, { once: true });
  window.addEventListener("load", tryStartOnLifecycle, { once: true });
  window.addEventListener("pageshow", tryStartOnLifecycle);
  window.addEventListener("focus", tryStartOnLifecycle);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      tryStartOnLifecycle();
    }
  });

  const removeUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
    window.removeEventListener("touchend", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    document.removeEventListener("click", unlockAudio, true);
    window.removeEventListener("mousedown", unlockAudio);
  };

  // Fallback: start on first user interaction if browser blocked autoplay.
  const unlockAudio = () => {
    wantsMusic = true;
    autoStartTryCount = 0;
    startMedia().then((started) => {
      if (started) {
        removeUnlockListeners();
      }
    });
  };

  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });
  window.addEventListener("touchend", unlockAudio, { passive: true });
  window.addEventListener("mousedown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);
  document.addEventListener("click", unlockAudio, true);

  window.addEventListener("pointerdown", tryUnmuteBootstrapAudio, { passive: true });
  window.addEventListener("keydown", tryUnmuteBootstrapAudio);

  if (musicToggle) {
    musicToggle.addEventListener("click", () => {
      if (bgm.paused) {
        wantsMusic = true;
        autoStartTryCount = 0;
        startMedia();
      } else {
        wantsMusic = false;
        bgm.pause();
        clearAutoStartTimer();
        hideMusicGate();
        setMusicButtonState();
      }
    });
  }

  if (isTouchDevice) {
    window.addEventListener("load", () => {
      window.setTimeout(() => {
        if (wantsMusic && bgm.paused) {
          showMusicGate();
        }
      }, 700);
    }, { once: true });
  }

  bgm.addEventListener("play", setMusicButtonState);
  bgm.addEventListener("play", hideMusicGate);
  bgm.addEventListener("pause", () => {
    setMusicButtonState();
    if (wantsMusic) {
      scheduleAutoStartRetry(220);
    }
  });
  bgm.addEventListener("play", tryUnmuteBootstrapAudio);
  ["loadeddata", "canplay", "canplaythrough"].forEach((eventName) => {
    bgm.addEventListener(eventName, () => {
      if (wantsMusic && bgm.paused) {
        tryStartOnLifecycle();
      } else {
        tryUnmuteBootstrapAudio();
      }
    });
  });
  ["stalled", "waiting", "suspend"].forEach((eventName) => {
    bgm.addEventListener(eventName, () => {
      if (wantsMusic && bgm.paused) {
        scheduleAutoStartRetry(400);
      }
    });
  });
  // Aggressive startup: try immediately, then lifecycle, then user interaction.
  window.setTimeout(() => {
    if (bgm.paused && wantsMusic) {
      tryStartOnLifecycle();
    }
  }, 50);
  setMusicButtonState();
}

function updateNavbarState() {
  if (!navbar) return;
  if (window.scrollY > 20) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
}

updateNavbarState();
window.addEventListener("scroll", updateNavbarState, { passive: true });

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const countdownEls = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
  status: document.getElementById("countdownStatus"),
};

// 10 April 2026, 09:00 AM IST = 03:30 UTC
const targetDate = new Date("2026-04-10T03:30:00Z").getTime();

function updateCountdown() {
  const now = Date.now();
  const delta = targetDate - now;

  if (delta <= 0) {
    ["days", "hours", "minutes", "seconds"].forEach((unit) => {
      if (countdownEls[unit]) countdownEls[unit].textContent = "00";
    });
    if (countdownEls.status) {
      countdownEls.status.textContent = "Hackathon has started.";
    }
    return false;
  }

  const days = Math.floor(delta / (1000 * 60 * 60 * 24));
  const hours = Math.floor((delta / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((delta / (1000 * 60)) % 60);
  const seconds = Math.floor((delta / 1000) % 60);

  if (countdownEls.days) countdownEls.days.textContent = String(days).padStart(2, "0");
  if (countdownEls.hours) countdownEls.hours.textContent = String(hours).padStart(2, "0");
  if (countdownEls.minutes) countdownEls.minutes.textContent = String(minutes).padStart(2, "0");
  if (countdownEls.seconds) countdownEls.seconds.textContent = String(seconds).padStart(2, "0");
  if (countdownEls.status) countdownEls.status.textContent = "April 10, 2026 at 09:00 AM IST";

  return true;
}

if (updateCountdown()) {
  const timer = setInterval(() => {
    if (!updateCountdown()) {
      clearInterval(timer);
    }
  }, 1000);
}

const revealItems = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealItems.forEach((item) => revealObserver.observe(item));

const counters = document.querySelectorAll(".counter");
const counterObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      const target = Number(el.getAttribute("data-target") || "0");
      const duration = 900;
      const start = performance.now();

      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const value = Math.floor(progress * target);
        el.textContent = value.toLocaleString("en-IN");
        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      }

      requestAnimationFrame(tick);
      observer.unobserve(el);
    });
  },
  { threshold: 0.35 }
);

counters.forEach((counter) => counterObserver.observe(counter));

