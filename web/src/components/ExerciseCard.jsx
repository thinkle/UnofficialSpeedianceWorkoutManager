import { useCallback } from 'react'
import SetEditor from './SetEditor.jsx'
import { PRESET_OPTIONS, applyPresetToSets, createDefaultSetFromPreset } from '../lib/presets.js'

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function ExerciseCard({
  exercise,
  index,
  totalCount,
  isSelected,
  condensed,
  onToggleSelect,
  onMove,
  onRemove,
  onUpdateExercise,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
}) {
  const handlePresetChange = useCallback(
    (e) => {
      const newPresetId = parseInt(e.target.value, 10)
      const updatedSets = applyPresetToSets(exercise.sets, newPresetId)
      onUpdateExercise(exercise.id, { preset_id: newPresetId, sets: updatedSets })
    },
    [exercise.id, exercise.sets, onUpdateExercise]
  )

  const handleAddSet = useCallback(() => {
    const newSet = createDefaultSetFromPreset(exercise.preset_id)
    onAddSet(exercise.id, newSet)
  }, [exercise.id, exercise.preset_id, onAddSet])

  const handleSetUpdate = useCallback(
    (setId, updates) => {
      onUpdateSet(exercise.id, setId, updates)
    },
    [exercise.id, onUpdateSet]
  )

  const handleSetRemove = useCallback(
    (setId) => {
      onRemoveSet(exercise.id, setId)
    },
    [exercise.id, onRemoveSet]
  )

  return (
    <div
      className={`builder-exercise${isSelected ? ' builder-exercise-selected' : ''}${condensed ? ' builder-exercise-condensed' : ''}`}
    >
      <div className="builder-exercise-header">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(exercise.id)}
        />
        {exercise.img ? (
          <img src={exercise.img} alt="" className="builder-exercise-img" />
        ) : null}
        <div className="builder-exercise-info">
          <div
            className="builder-exercise-title"
            style={{ cursor: 'pointer' }}
            onDoubleClick={() => {
              console.group(`Exercise: ${exercise.title}`)
              console.log('Exercise data:', exercise)
              console.log('Sets:', exercise.sets)
              console.groupEnd()
            }}
            title="Double-click to log exercise JSON to console"
          >
            {exercise.title}
          </div>
          <div className="builder-exercise-meta">
            {exercise.sets.length} sets
            {exercise.isUnilateral ? ' (Unilateral L/R)' : ''}
          </div>
        </div>
        <div className="builder-exercise-controls">
          <select
            value={exercise.preset_id}
            onChange={handlePresetChange}
            className="builder-select builder-preset-select"
          >
            {PRESET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name} ({opt.suffix})
              </option>
            ))}
          </select>
        </div>
        <div className="builder-exercise-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onMove(exercise.id, -1)}
            disabled={index === 0}
          >
            up
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onMove(exercise.id, 1)}
            disabled={index === totalCount - 1}
          >
            dn
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-danger"
            onClick={() => onRemove(exercise.id)}
          >
            x
          </button>
        </div>
      </div>

      {!condensed ? (
        <div className="builder-sets">
          {exercise.sets.map((set, setIndex) => (
            <SetEditor
              key={set.id}
              set={set}
              index={setIndex}
              presetId={exercise.preset_id}
              isUnilateral={exercise.isUnilateral}
              onUpdate={handleSetUpdate}
              onRemove={handleSetRemove}
              canRemove={exercise.sets.length > 1}
            />
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddSet}>
            + Add Set
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default ExerciseCard
