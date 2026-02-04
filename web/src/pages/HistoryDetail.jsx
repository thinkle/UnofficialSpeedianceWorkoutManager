import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { fetchHistoryDetail } from "../lib/history.js";
import { useAuth } from "../state/AuthContext.jsx";

function ExerciseCard({ exercise, showImage = true }) {
  return (
    <div className="history-exercise">
      <div className="history-exercise-header">
        {showImage && exercise.img ? (
          <img src={exercise.img} alt="" className="history-exercise-img" />
        ) : null}
        <div className="history-exercise-title">{exercise.name}</div>
      </div>
      {exercise.metrics?.length ? (
        <div className="history-exercise-metrics">
          {exercise.metrics.map((metric) => (
            <span key={metric.label} className="history-metric-badge">
              {metric.label}: {metric.value}
            </span>
          ))}
        </div>
      ) : null}
      {exercise.sets?.length ? (
        <details className="history-sets">
          <summary>Set details ({exercise.sets.length})</summary>
          <div className="history-sets-grid">
            {exercise.sets.map((set, index) => (
              <div key={index} className="history-set-card">
                <div className="history-set-title">
                  Set {set.index ?? index + 1}
                </div>
                <div>Reps: {set.reps}</div>
                {set.time ? <div>Time: {set.time}</div> : null}
                {set.avg_weight ? <div>Weight: {set.avg_weight}</div> : null}
                {set.capacity ? <div>Volume: {set.capacity}</div> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function CircuitBlock({ block }) {
  return (
    <div className="history-circuit">
      <div className="history-circuit-header">
        <span className="history-circuit-badge">
          Circuit · {block.cycleLen} exercises × {block.rounds} rounds
        </span>
      </div>
      <div className="history-circuit-exercises">
        {block.exercises.map((circuitExercise, exIndex) => {
          // Aggregate metrics across all rounds for this exercise
          const allSets = circuitExercise.rounds.flatMap((r, roundIdx) =>
            (r.exerciseRow.sets || []).map((set, setIdx) => ({
              ...set,
              index: `R${roundIdx + 1}`,
            })),
          );
          const totalReps = circuitExercise.rounds.reduce((sum, r) => {
            const sets = r.exerciseRow.sets || [];
            return (
              sum +
              sets.reduce((s, set) => {
                const reps = parseInt(set.reps, 10);
                return s + (Number.isNaN(reps) ? 0 : reps);
              }, 0)
            );
          }, 0);

          // Get weight range across all rounds
          const weights = circuitExercise.rounds
            .map((r) => {
              const weightMetric = r.exerciseRow.metrics?.find(
                (m) => m.label === "Weight",
              );
              if (weightMetric) {
                const match = weightMetric.value.match(/[\d.]+/);
                return match ? parseFloat(match[0]) : null;
              }
              return null;
            })
            .filter((w) => w !== null && w > 0);

          const minWeight = weights.length ? Math.min(...weights) : null;
          const maxWeight = weights.length ? Math.max(...weights) : null;
          const unitMatch = circuitExercise.rounds[0]?.exerciseRow.metrics
            ?.find((m) => m.label === "Weight")
            ?.value.match(/(lbs|kg)/);
          const unit = unitMatch ? unitMatch[1] : "";

          return (
            <div key={exIndex} className="history-circuit-exercise">
              <div className="history-exercise-header">
                {circuitExercise.img ? (
                  <img
                    src={circuitExercise.img}
                    alt=""
                    className="history-exercise-img"
                  />
                ) : null}
                <div>
                  <div className="history-exercise-title">
                    {circuitExercise.name}
                  </div>
                  <div className="history-exercise-metrics">
                    <span className="history-metric-badge">
                      {block.rounds} sets
                    </span>
                    {totalReps > 0 ? (
                      <span className="history-metric-badge">
                        {totalReps} total reps
                      </span>
                    ) : null}
                    {minWeight !== null ? (
                      <span className="history-metric-badge">
                        {minWeight === maxWeight
                          ? `${minWeight} ${unit}`
                          : `${minWeight}–${maxWeight} ${unit}`}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <details className="history-sets">
                <summary>Round details</summary>
                <div className="history-sets-grid">
                  {circuitExercise.rounds.map((round, roundIdx) => {
                    const ex = round.exerciseRow;
                    const weightMetric = ex.metrics?.find(
                      (m) => m.label === "Weight",
                    );
                    const timeMetric = ex.metrics?.find(
                      (m) => m.label === "Time",
                    );
                    const set = ex.sets?.[0];
                    return (
                      <div key={roundIdx} className="history-set-card">
                        <div className="history-set-title">
                          Round {roundIdx + 1}
                        </div>
                        {set?.reps ? <div>Reps: {set.reps}</div> : null}
                        {weightMetric ? (
                          <div>Weight: {weightMetric.value}</div>
                        ) : null}
                        {timeMetric ? (
                          <div>Time: {timeMetric.value}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryDetail() {
  const { sessionId } = useParams();
  const { config, clearAuth } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [detail, setDetail] = useState(null);
  const [raw, setRaw] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadDetail = async () => {
      if (!sessionId) return;
      setStatus({ type: "loading", message: "Loading details..." });
      const response = await fetchHistoryDetail(config, sessionId);
      if (!isMounted) return;

      if (response.unauthorized) {
        clearAuth();
        navigate("/settings", { replace: true });
        return;
      }

      if (!response.ok) {
        setStatus({
          type: "error",
          message: response.error || "Failed to load details.",
        });
        return;
      }

      setDetail(response.data);
      setRaw(response.raw);
      setStatus({ type: "success", message: "" });
    };

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [sessionId, config, clearAuth, navigate]);

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Session detail</p>
          <h1 className="page-title">
            {detail?.title || `Session ${sessionId || "--"}`}
          </h1>
          <p className="page-subtitle">Training ID: {sessionId}</p>
        </div>
        <NavLink className="btn btn-outline" to="/history">
          Back to History
        </NavLink>
      </section>

      {status.type === "loading" ? (
        <div className="notice notice-loading">{status.message}</div>
      ) : null}
      {status.type === "error" ? (
        <div className="notice notice-error">{status.message}</div>
      ) : null}

      {detail ? (
        <>
          <section className="grid-2">
            <div className="card">
              <h2 className="section-title">Overview</h2>
              <div className="stack">
                {detail.start_time ? (
                  <div>Start: {detail.start_time}</div>
                ) : null}
                {detail.end_time ? <div>End: {detail.end_time}</div> : null}
                {detail.device ? <div>Device: {detail.device}</div> : null}
              </div>
              {detail.metrics?.length ? (
                <div className="stat-grid" style={{ marginTop: "16px" }}>
                  {detail.metrics.map((metric) => (
                    <div key={metric.label} className="stat">
                      <div className="stat-label">{metric.label}</div>
                      <div className="stat-value">{metric.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="card">
              <h2 className="section-title">Tips</h2>
              <p className="page-subtitle">
                Use the debug panel below to inspect the raw API response for
                this session.
              </p>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Exercises</h2>
            {detail.blocks?.length ? (
              <div className="stack">
                {detail.blocks.map((block, blockIndex) => {
                  if (block.type === "circuit") {
                    return <CircuitBlock key={blockIndex} block={block} />;
                  }
                  return (
                    <ExerciseCard
                      key={blockIndex}
                      exercise={{ ...block.exercise, img: block.raw?.img }}
                    />
                  );
                })}
              </div>
            ) : detail.exercises?.length ? (
              <div className="stack">
                {detail.exercises.map((exercise, index) => (
                  <ExerciseCard key={index} exercise={exercise} />
                ))}
              </div>
            ) : (
              <div className="builder-muted">
                No exercise detail list found in the response.
              </div>
            )}
          </section>

          {raw ? (
            <details className="history-raw">
              <summary>Raw payload</summary>
              <pre>{JSON.stringify(raw, null, 2)}</pre>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default HistoryDetail;
