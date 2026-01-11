import { NavLink } from 'react-router-dom'

const exerciseFilters = ['All', 'Strength', 'Conditioning', 'Mobility', 'Core', 'Lower']

const sampleExercises = [
  { id: 'cable-press', name: 'Cable Press', focus: 'Chest', equipment: 'Dual handles' },
  { id: 'incline-row', name: 'Incline Row', focus: 'Back', equipment: 'Bench + cables' },
  { id: 'split-squat', name: 'Split Squat', focus: 'Lower', equipment: 'Handles' },
  { id: 'overhead-press', name: 'Overhead Press', focus: 'Shoulders', equipment: 'Bar' },
  { id: 'high-pull', name: 'High Pull', focus: 'Full body', equipment: 'Bar or handles' },
  { id: 'core-rotation', name: 'Core Rotation', focus: 'Core', equipment: 'Cable' },
]

function Library() {
  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="page-title">Browse the exercise library.</h1>
          <p className="page-subtitle">Filter, inspect, and save favorites for faster planning.</p>
        </div>
        <div className="search-field">
          <input type="text" placeholder="Search exercises" />
          <span className="search-hint">Press / to focus</span>
        </div>
      </section>

      <section className="filter-row">
        {exerciseFilters.map((filter) => (
          <button key={filter} className="chip" type="button">
            {filter}
          </button>
        ))}
        <div className="filter-meta">0 selected</div>
      </section>

      <section className="grid-3">
        {sampleExercises.map((exercise) => (
          <div key={exercise.id} className="card exercise-card">
            <div className="exercise-header">
              <span className="tag">{exercise.focus}</span>
              <NavLink className="btn btn-ghost" to={`/library/${exercise.id}`}>
                Details
              </NavLink>
            </div>
            <div className="exercise-title">{exercise.name}</div>
            <div className="exercise-meta">{exercise.equipment}</div>
          </div>
        ))}
      </section>
    </div>
  )
}

export default Library
