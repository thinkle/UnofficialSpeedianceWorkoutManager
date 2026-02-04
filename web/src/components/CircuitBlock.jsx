import { useCallback } from 'react'
import { PRESET_OPTIONS, getPresetRules, clampToRules, MODE_OPTIONS } from '../lib/presets.js'

/**
 * CircuitBlock displays a circuit training block.
 * A circuit has multiple exercises that are performed in rotation for multiple rounds.
 *
 * Props:
 * - block: { type: 'circuit', exercises: [[ex, ex, ...], ...], rounds, cycleLen, start }
 *   where exercises is an array of arrays: each inner array contains the exercise instances
 *   for one position across all rounds
 * - blockIndex: index of this block in the parsed workout
 * - condensed: whether to show condensed view
 * - onUndoCircuit: callback to convert circuit back to individual exercises
 * - onRemoveCircuit: callback to remove entire circuit
 * - onMoveCircuit: callback to move circuit up/down
 * - onAddRound: callback to add another round to the circuit
 * - onRemoveRound: callback to remove a round from the circuit
 * - onRemoveExercise: callback to remove an exercise position from the circuit
 * - onUpdateExercise: callback to update exercise properties (preset, etc.)
 * - onUpdateSet: callback to update a specific set within the circuit
 * - totalBlocks: total number of blocks for move button disabling
 */
function CircuitBlock({
  block,
  blockIndex,
  condensed,
  onUndoCircuit,
  onRemoveCircuit,
  onMoveCircuit,
  onAddRound,
  onRemoveRound,
  onRemoveExercise,
  onUpdateExercise,
  onUpdateSet,
  totalBlocks,
}) {
  const { exercises, rounds } = block

  // Build a view-friendly structure
  // exercises[positionIndex][roundIndex] = exercise instance
  const positions = exercises.map((positionEntries, positionIndex) => {
    const base = positionEntries[0]
    return {
      positionIndex,
      title: base?.title || 'Untitled',
      img: base?.img || '',
      groupId: base?.groupId,
      preset_id: base?.preset_id ?? -1,
      isUnilateral: base?.isUnilateral || false,
      rounds: positionEntries,
    }
  })

  const handlePresetChange = useCallback(
    (positionIndex, e) => {
      const newPresetId = parseInt(e.target.value, 10)
      onUpdateExercise(blockIndex, positionIndex, { preset_id: newPresetId })
    },
    [blockIndex, onUpdateExercise]
  )

  const handleSetChange = useCallback(
    (positionIndex, roundIndex, setIndex, field, value) => {
      let parsed = field === 'weight' ? parseFloat(value) : parseInt(value, 10)
      if (Number.isNaN(parsed)) parsed = 0
      onUpdateSet(blockIndex, positionIndex, roundIndex, setIndex, { [field]: parsed })
    },
    [blockIndex, onUpdateSet]
  )

  return (
    <div className="circuit-block">
      <div className="circuit-header">
        <div className="circuit-title">
          Circuit ({positions.length} exercises x {rounds} rounds)
        </div>
        <div className="circuit-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onMoveCircuit(blockIndex, -1)}
            disabled={blockIndex === 0}
          >
            up
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onMoveCircuit(blockIndex, 1)}
            disabled={blockIndex === totalBlocks - 1}
          >
            dn
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onAddRound(blockIndex)}
          >
            +Round
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onRemoveRound(blockIndex)}
            disabled={rounds <= 2}
          >
            -Round
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onUndoCircuit(blockIndex)}
          >
            Undo Circuit
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-danger"
            onClick={() => onRemoveCircuit(blockIndex)}
          >
            x
          </button>
        </div>
      </div>

      {!condensed ? (
        <div className="circuit-body">
          <table className="circuit-table">
            <thead>
              <tr>
                <th className="circuit-th-exercise">Exercise</th>
                {Array.from({ length: rounds }, (_, i) => (
                  <th key={i} className="circuit-th-round">
                    Round {i + 1}
                  </th>
                ))}
                <th className="circuit-th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <CircuitRow
                  key={pos.positionIndex}
                  position={pos}
                  rounds={rounds}
                  blockIndex={blockIndex}
                  onPresetChange={handlePresetChange}
                  onSetChange={handleSetChange}
                  onRemoveExercise={onRemoveExercise}
                  canRemove={positions.length > 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="circuit-condensed">
          {positions.map((pos) => (
            <div key={pos.positionIndex} className="circuit-condensed-item">
              {pos.img ? <img src={pos.img} alt="" className="circuit-condensed-img" /> : null}
              <span>{pos.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CircuitRow({
  position,
  rounds,
  blockIndex,
  onPresetChange,
  onSetChange,
  onRemoveExercise,
  canRemove,
}) {
  const rules = getPresetRules(position.preset_id)

  return (
    <tr className="circuit-row">
      <td className="circuit-cell-exercise">
        <div className="circuit-exercise-info">
          {position.img ? (
            <img src={position.img} alt="" className="circuit-exercise-img" />
          ) : null}
          <div>
            <div className="circuit-exercise-title">{position.title}</div>
            <select
              value={position.preset_id}
              onChange={(e) => onPresetChange(position.positionIndex, e)}
              className="builder-select builder-preset-select"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name} ({opt.suffix})
                </option>
              ))}
            </select>
          </div>
        </div>
      </td>
      {position.rounds.map((entry, roundIndex) => (
        <td key={roundIndex} className="circuit-cell-round">
          {entry?.sets?.map((set, setIndex) => (
            <div key={set.id || setIndex} className="circuit-set">
              <input
                type="number"
                value={set.reps}
                min={rules.minR}
                max={rules.maxR}
                onChange={(e) =>
                  onSetChange(position.positionIndex, roundIndex, setIndex, 'reps', e.target.value)
                }
                className="circuit-input circuit-input-reps"
                title="Reps"
              />
              <span className="circuit-set-x">x</span>
              <input
                type="number"
                value={set.weight}
                min={rules.minW}
                max={rules.maxW}
                step={rules.step}
                onChange={(e) =>
                  onSetChange(
                    position.positionIndex,
                    roundIndex,
                    setIndex,
                    'weight',
                    e.target.value
                  )
                }
                className={`circuit-input circuit-input-weight${position.preset_id !== -1 ? ' input-rm' : ''}`}
                title={rules.label}
              />
              <span className="circuit-set-label">{rules.label}</span>
            </div>
          )) || <span className="builder-muted">-</span>}
        </td>
      ))}
      <td className="circuit-cell-actions">
        {canRemove ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-danger"
            onClick={() => onRemoveExercise(blockIndex, position.positionIndex)}
          >
            x
          </button>
        ) : null}
      </td>
    </tr>
  )
}

export default CircuitBlock
