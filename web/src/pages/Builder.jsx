const sampleLibrary = [
  'Press variation',
  'Row variation',
  'Squat pattern',
  'Core stability',
]

const samplePlan = [
  { name: 'Warm-up', detail: 'Mobility + activation' },
  { name: 'Main flow', detail: '3 supersets' },
  { name: 'Finish', detail: 'Core circuit' },
]

function Builder() {
  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Builder</p>
          <h1 className="page-title">Design a new workout plan.</h1>
          <p className="page-subtitle">Drag exercises into place and tune sets with precision.</p>
        </div>
        <button className="btn btn-primary" type="button">Save plan</button>
      </section>

      <section className="grid-2 builder-layout">
        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Exercise library</h2>
            <button className="btn btn-ghost" type="button">Filter</button>
          </div>
          <div className="stack">
            {sampleLibrary.map((item) => (
              <div key={item} className="list-row">
                <div>
                  <div className="list-title">{item}</div>
                  <div className="list-detail">Tap to add to the plan.</div>
                </div>
                <button className="btn btn-outline" type="button">Add</button>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Plan outline</h2>
            <button className="btn btn-ghost" type="button">Settings</button>
          </div>
          <div className="stack">
            {samplePlan.map((block) => (
              <div key={block.name} className="highlight">
                <div className="highlight-title">{block.name}</div>
                <div className="highlight-copy">{block.detail}</div>
              </div>
            ))}
            <button className="btn btn-outline" type="button">Add block</button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Builder
