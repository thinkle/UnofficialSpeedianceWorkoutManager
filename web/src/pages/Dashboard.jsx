import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  deleteWorkout,
  fetchCalendarMonth,
  fetchWorkouts,
  fetchWorkoutDetail,
  scheduleWorkout,
} from "../lib/workouts.js";
import { useAuth } from "../state/AuthContext.jsx";
import { condenseApiWorkout } from "../lib/export.js";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthLabel(date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function getMonthString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS" formats
  const dateOnly = dateStr.split("T")[0];
  const parts = dateOnly.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  // Create date in local timezone at midnight
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseUTCToLocalDateString(utcDateTimeStr) {
  // Parse "2026-02-04 01:55:17" as UTC and return local date string "YYYY-MM-DD"
  if (!utcDateTimeStr) return null;
  // Replace space with T and add Z to indicate UTC
  const isoStr = utcDateTimeStr.replace(" ", "T") + "Z";
  const utcDate = new Date(isoStr);
  if (isNaN(utcDate.getTime())) return null;
  return getLocalDateString(utcDate);
}

function isPastDate(dateStr) {
  return dateStr < getTodayString();
}

function normalizeWorkouts(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    title: item.name || item.title || "Workout",
  }));
}

function Dashboard() {
  const { config, isAuthenticated, clearAuth } = useAuth();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [workoutStatus, setWorkoutStatus] = useState({
    type: "idle",
    message: "",
  });
  const [calendarStatus, setCalendarStatus] = useState({
    type: "idle",
    message: "",
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [search, setSearch] = useState("");
  const [exportStatus, setExportStatus] = useState({
    type: "idle",
    message: "",
  });
  const [exportData, setExportData] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState("condensed");

  const activeExportData = useMemo(() => {
    if (!exportData) return null;
    if (exportMode === "condensed") return exportData.map(condenseApiWorkout);
    return exportData;
  }, [exportData, exportMode]);

  useEffect(() => {
    let isMounted = true;

    const loadWorkouts = async () => {
      if (!isAuthenticated) return;
      setWorkoutStatus({ type: "loading", message: "Loading workouts..." });
      const response = await fetchWorkouts(config);
      if (!isMounted) return;

      if (response.unauthorized) {
        clearAuth();
        navigate("/settings", { replace: true });
        return;
      }

      if (!response.ok) {
        setWorkoutStatus({
          type: "error",
          message: response.error || "Failed to load workouts.",
        });
        return;
      }

      setWorkouts(normalizeWorkouts(response.data));
      setWorkoutStatus({ type: "success", message: "" });
    };

    loadWorkouts();

    return () => {
      isMounted = false;
    };
  }, [config, isAuthenticated, clearAuth, navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadCalendar = async () => {
      if (!isAuthenticated) return;
      setCalendarStatus({ type: "loading", message: "Loading calendar..." });
      const response = await fetchCalendarMonth(
        config,
        getMonthString(currentDate),
      );
      if (!isMounted) return;

      if (response.unauthorized) {
        clearAuth();
        navigate("/settings", { replace: true });
        return;
      }

      if (!response.ok) {
        setCalendarStatus({
          type: "error",
          message: response.error || "Failed to load calendar.",
        });
        return;
      }

      setCalendarData(Array.isArray(response.data) ? response.data : []);
      setCalendarStatus({ type: "success", message: "" });
    };

    loadCalendar();

    return () => {
      isMounted = false;
    };
  }, [config, isAuthenticated, currentDate, clearAuth, navigate]);

  const filteredWorkouts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return workouts;
    return workouts.filter((workout) =>
      (workout.title || "").toLowerCase().includes(term),
    );
  }, [workouts, search]);

  const calendarGrid = useMemo(() => {
    if (!calendarData.length) return [];

    // Regroup workouts by local date for completed workouts (finishTime is in UTC)
    const regroupedData = calendarData.map((day) => {
      const newDay = { ...day, trainingPlanList: [] };
      return newDay;
    });

    // Build a map of date -> day object for easy lookup
    const dateMap = new Map();
    regroupedData.forEach((day) => {
      dateMap.set(day.date, day);
    });

    // Re-distribute workouts based on their actual local date
    calendarData.forEach((day) => {
      (day.trainingPlanList || []).forEach((workout) => {
        let targetDate = day.date;

        // For completed workouts, use finishTime to get the correct local date
        if (workout.isReservation === false && workout.finishTime) {
          const localDate = parseUTCToLocalDateString(workout.finishTime);
          if (localDate) {
            targetDate = localDate;
          }
        }

        // Add workout to the correct date
        const targetDay = dateMap.get(targetDate);
        if (targetDay) {
          targetDay.trainingPlanList.push(workout);
        }
      });
    });

    const firstDate = parseLocalDate(regroupedData[0].date);
    const startDay = firstDate ? firstDate.getDay() : 0;
    const blanks = Array.from({ length: startDay }).map(() => null);
    return [...blanks, ...regroupedData];
  }, [calendarData]);

  const handleSelectWorkout = (workout) => {
    if (selectedWorkout && selectedWorkout.code === workout.code) {
      setSelectedWorkout(null);
      return;
    }
    setSelectedWorkout(workout);
  };

  const updateCalendarDay = (dateStr, updater) => {
    setCalendarData((current) =>
      current.map((day) => {
        if (day.date !== dateStr) return day;
        const updated = { ...day };
        updated.trainingPlanList = updater(updated.trainingPlanList || []);
        return updated;
      }),
    );
  };

  const handleSchedule = async (dateStr, workout) => {
    if (!workout?.code) return;
    if (isPastDate(dateStr)) {
      setCalendarStatus({
        type: "error",
        message: "Cannot schedule in the past.",
      });
      return;
    }

    const response = await scheduleWorkout(config, dateStr, workout.code, 1);
    if (response.unauthorized) {
      clearAuth();
      navigate("/settings", { replace: true });
      return;
    }
    if (!response.ok) {
      setCalendarStatus({
        type: "error",
        message: response.error || "Failed to schedule workout.",
      });
      return;
    }

    updateCalendarDay(dateStr, (list) => {
      const exists = list.some(
        (entry) => (entry.code || entry.templateCode) === workout.code,
      );
      if (exists) return list;
      return [
        ...list,
        { title: workout.title, code: workout.code, isReservation: true },
      ];
    });
  };

  const handleRemoveSchedule = async (dateStr, code) => {
    const response = await scheduleWorkout(config, dateStr, code, 0);
    if (response.unauthorized) {
      clearAuth();
      navigate("/settings", { replace: true });
      return;
    }
    if (!response.ok) {
      setCalendarStatus({
        type: "error",
        message: response.error || "Failed to remove workout.",
      });
      return;
    }

    updateCalendarDay(dateStr, (list) =>
      list.filter((entry) => (entry.code || entry.templateCode) !== code),
    );
  };

  const handleExportAll = async () => {
    setShowExport(true);
    setExportStatus({
      type: "loading",
      message: `Exporting 0/${workouts.length} workouts...`,
    });
    setExportData(null);

    const detailed = [];
    for (let i = 0; i < workouts.length; i++) {
      const workout = workouts[i];
      setExportStatus({
        type: "loading",
        message: `Exporting ${i + 1}/${workouts.length}: ${workout.title}...`,
      });

      const response = await fetchWorkoutDetail(config, workout.code);
      if (response.unauthorized) {
        clearAuth();
        navigate("/settings", { replace: true });
        return;
      }

      if (response.ok && response.data) {
        detailed.push(response.data);
      } else {
        detailed.push({ ...workout, _error: "Failed to fetch details" });
      }
    }

    setExportData(detailed);
    setExportStatus({
      type: "success",
      message: `Exported ${detailed.length} workouts.`,
    });
  };

  const handleCopyExport = async () => {
    if (!activeExportData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(activeExportData, null, 2));
      setExportStatus({ type: "success", message: "Copied to clipboard!" });
    } catch (err) {
      setExportStatus({
        type: "error",
        message: "Failed to copy to clipboard.",
      });
    }
  };

  const handleDownloadExport = () => {
    if (!activeExportData) return;
    const blob = new Blob([JSON.stringify(activeExportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const suffix = exportMode === "condensed" ? "-condensed" : "";
    link.download = `speediance-workouts${suffix}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteWorkout = async (workout) => {
    if (!window.confirm(`Delete "${workout.title}"? This cannot be undone.`)) {
      return;
    }

    setWorkoutStatus({ type: "loading", message: "Deleting workout..." });
    const response = await deleteWorkout(config, workout.id);
    if (response.unauthorized) {
      clearAuth();
      navigate("/settings", { replace: true });
      return;
    }
    if (!response.ok) {
      setWorkoutStatus({
        type: "error",
        message: response.error || "Failed to delete workout.",
      });
      return;
    }

    setWorkouts((current) => current.filter((w) => w.id !== workout.id));
    if (selectedWorkout?.id === workout.id) {
      setSelectedWorkout(null);
    }
    setWorkoutStatus({ type: "success", message: "" });
  };

  return (
    <div className="page dashboard-page">
      <section className="page-header">
        <div>
          <p className="eyebrow"></p>
          <h1 className="page-title">My workouts</h1>
          <p className="page-subtitle">
            Select a workout to schedule it on the calendar.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleExportAll}
            disabled={workouts.length === 0 || exportStatus.type === "loading"}
          >
            Export All
          </button>
          <Link to="/create" className="btn btn-primary">
            + New Workout
          </Link>
        </div>
      </section>

      {showExport ? (
        <div className="export-panel">
          <div className="export-header">
            <h3>Export Workouts</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowExport(false)}
            >
              Close
            </button>
          </div>
          {exportStatus.type === "loading" ? (
            <div className="notice notice-loading">{exportStatus.message}</div>
          ) : null}
          {exportStatus.type === "error" ? (
            <div className="notice notice-error">{exportStatus.message}</div>
          ) : null}
          {exportStatus.type === "success" && exportData ? (
            <>
              <div className="notice notice-success">
                {exportStatus.message}
              </div>
              <div className="export-actions">
                <div className="export-mode-toggle">
                  <button
                    type="button"
                    className={`btn btn-sm ${exportMode === "condensed" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setExportMode("condensed")}
                  >
                    Condensed
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${exportMode === "full" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setExportMode("full")}
                  >
                    Full
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCopyExport}
                >
                  Copy to Clipboard
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleDownloadExport}
                >
                  Download JSON
                </button>
              </div>
              <div className="builder-muted">
                {exportMode === "condensed"
                  ? "Human-readable format — great for sharing with an LLM coach."
                  : "Full raw API data — use this for archival or debugging."}
              </div>
              <textarea
                className="export-json"
                readOnly
                value={JSON.stringify(activeExportData, null, 2)}
                rows={20}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {workoutStatus.type === "loading" ? (
        <div className="notice notice-loading">{workoutStatus.message}</div>
      ) : null}
      {workoutStatus.type === "error" ? (
        <div className="notice notice-error">{workoutStatus.message}</div>
      ) : null}

      <div className="dashboard-layout">
        <div className="dashboard-workouts">
          <div className="dashboard-toolbar">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter workouts by name..."
            />
            <div className="dashboard-meta">
              {filteredWorkouts.length} workouts
            </div>
          </div>

          <div className="workout-grid">
            {filteredWorkouts.map((workout) => (
              <div
                key={workout.code || workout.id}
                className={`workout-card${selectedWorkout?.code === workout.code ? " workout-card-active" : ""}`}
              >
                <button
                  type="button"
                  className="workout-card-body"
                  onClick={() => handleSelectWorkout(workout)}
                >
                  <div className="workout-card-title">{workout.title}</div>
                  <div className="workout-card-meta">
                    <span>
                      Volume: {workout.totalCapacity || "--"}{" "}
                      {config.unit === 1 ? "lbs" : "kg"}
                    </span>
                    <span>Duration: ~{workout.durationMinute || "--"} min</span>
                    <span>Exercises: {workout.actionNum || "--"}</span>
                  </div>
                </button>
                <div className="workout-card-actions">
                  <Link
                    to={`/edit/${workout.code}`}
                    className="workout-action workout-action-edit"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="workout-action workout-action-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkout(workout);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {selectedWorkout && (
            <div className="scheduling-hint">
              📅 Click on a day in the calendar to schedule "
              {selectedWorkout.title}"
            </div>
          )}
        </div>

        <div className="dashboard-calendar">
          <div className="calendar-header">
            <button
              type="button"
              onClick={() =>
                setCurrentDate((prev) => {
                  const next = new Date(prev);
                  next.setMonth(next.getMonth() - 1);
                  return next;
                })
              }
            >
              Prev
            </button>
            <span>{getMonthLabel(currentDate)}</span>
            <button
              type="button"
              onClick={() =>
                setCurrentDate((prev) => {
                  const next = new Date(prev);
                  next.setMonth(next.getMonth() + 1);
                  return next;
                })
              }
            >
              Next
            </button>
          </div>

          {calendarStatus.type === "loading" ? (
            <div className="notice notice-loading">
              {calendarStatus.message}
            </div>
          ) : null}
          {calendarStatus.type === "error" ? (
            <div className="notice notice-error">{calendarStatus.message}</div>
          ) : null}

          <div className="calendar-weekdays">
            {weekDays.map((day) => (
              <div key={day} className="calendar-weekday">
                {day}
              </div>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarGrid.map((day, index) => {
              if (!day) {
                return (
                  <div
                    key={`blank-${index}`}
                    className="calendar-cell calendar-empty"
                  />
                );
              }

              const dateNumber = parseLocalDate(day.date)?.getDate() || "";
              const entries = day.trainingPlanList || [];
              return (
                <div
                  key={day.date}
                  className={`calendar-cell${isPastDate(day.date) ? " calendar-past" : ""}${selectedWorkout && !isPastDate(day.date) ? " calendar-schedulable" : ""}`}
                  onClick={() =>
                    selectedWorkout && handleSchedule(day.date, selectedWorkout)
                  }
                >
                  <div className="calendar-date">{dateNumber}</div>
                  <div
                    className={`calendar-events${entries.length > 2 ? " calendar-events-scroll" : ""}`}
                  >
                    {entries.map((entry, entryIndex) => {
                      const isCompleted =
                        entry.isReservation === false && entry.isFinish === 1;
                      const isPlanned = entry.isReservation === true;
                      const code = entry.code || entry.templateCode;

                      let pillClass = "calendar-pill";
                      if (isCompleted) pillClass += " calendar-pill-completed";
                      else if (isPlanned) pillClass += " calendar-pill-planned";

                      return (
                        <div
                          key={`${day.date}-${code || entryIndex}`}
                          className={pillClass}
                        >
                          {isCompleted && (
                            <span className="calendar-icon">✓</span>
                          )}
                          {isPlanned && (
                            <span className="calendar-icon">📅</span>
                          )}
                          <span className="calendar-pill-text">
                            {entry.title ||
                              entry.exclusivePlanName ||
                              "Workout"}
                          </span>
                          {isPlanned && code ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemoveSchedule(day.date, code);
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
