import { getPresetRules, clampToRules, MODE_OPTIONS } from '../lib/presets.js'

function SetEditor({
  set,
  index,
  presetId,
  isUnilateral,
  onUpdate,
  onRemove,
  canRemove = true,
  disabled = false,
}) {
  const rules = getPresetRules(presetId)
  const isRM = presetId !== -1

  // For unilateral exercises, we display L/R indicators
  let setDisplay = index + 1
  let sideLabel = null
  if (isUnilateral) {
    const realSetNum = Math.floor(index / 2) + 1
    const isLeft = index % 2 === 0
    setDisplay = realSetNum
    sideLabel = isLeft ? (
      <span className="set-side set-side-left">L</span>
    ) : (
      <span className="set-side set-side-right">R</span>
    )
  }

  const handleChange = (field, value) => {
    let parsed = field === 'weight' ? parseFloat(value) : parseInt(value, 10)
    if (Number.isNaN(parsed)) parsed = 0

    // Clamp to preset rules
    parsed = clampToRules(parsed, field, presetId)
    onUpdate(set.id, { [field]: parsed })
  }

  const toggleUnit = () => {
    onUpdate(set.id, { unit: set.unit === 'reps' ? 'sec' : 'reps' })
  }

  return (
    <div className="builder-set">
      <span
        className="builder-set-num"
        style={{ cursor: 'pointer' }}
        onDoubleClick={() => {
          console.group(`Set ${index + 1}`)
          console.log('Set data:', set)
          console.log('Preset ID:', presetId)
          console.log('Rules:', rules)
          console.groupEnd()
        }}
        title="Double-click to log set JSON to console"
      >
        {sideLabel}
        {setDisplay}
      </span>

      <label className="builder-set-field">
        <span>Reps</span>
        <div className="builder-set-field-row">
          <input
            type="number"
            min={rules.minR}
            max={rules.maxR}
            step={1}
            value={set.reps}
            onChange={(e) => handleChange('reps', e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={toggleUnit}
            disabled={disabled}
          >
            {set.unit === 'reps' ? 'Rep' : 'Sec'}
          </button>
        </div>
      </label>

      <label className="builder-set-field">
        <span>{rules.label}</span>
        <input
          type="number"
          min={rules.minW}
          max={rules.maxW}
          step={rules.step}
          value={set.weight}
          onChange={(e) => handleChange('weight', e.target.value)}
          className={isRM ? 'input-rm' : ''}
          disabled={disabled}
        />
      </label>

      <label className="builder-set-field">
        <span>Mode</span>
        <select
          value={set.mode}
          onChange={(e) => onUpdate(set.id, { mode: parseInt(e.target.value, 10) })}
          disabled={disabled}
        >
          {MODE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      </label>

      <label className="builder-set-field">
        <span>Rest</span>
        <input
          type="number"
          min={rules.minRest}
          max={rules.maxRest}
          step={5}
          value={set.rest}
          onChange={(e) => handleChange('rest', e.target.value)}
          disabled={disabled}
        />
      </label>

      {canRemove && !disabled ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-danger"
          onClick={() => onRemove(set.id)}
        >
          x
        </button>
      ) : (
        <span style={{ width: 28 }} />
      )}
    </div>
  )
}

export default SetEditor
