import { NavLink, useParams } from 'react-router-dom'

function ExerciseDetail() {
  const { exerciseId } = useParams()

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Exercise</p>
          <h1 className="page-title">Exercise detail</h1>
          <p className="page-subtitle">ID: {exerciseId || '--'} - Media and cues will load here.</p>
        </div>
        <NavLink className="btn btn-outline" to="/library">
          Back to library
        </NavLink>
      </section>

      <section className="grid-2">
        <div className="card media-preview">
          <div className="media-placeholder">Video preview</div>
        </div>
        <div className="card">
          <h2 className="section-title">Movement notes</h2>
          <div className="stack">
            <div className="highlight">
              <div className="highlight-title">Setup</div>
              <div className="highlight-copy">Body position, starting angle, and equipment cues.</div>
            </div>
            <div className="highlight">
              <div className="highlight-title">Execution</div>
              <div className="highlight-copy">Tempo, range of motion, and breathing guidance.</div>
            </div>
            <div className="highlight">
              <div className="highlight-title">Programming</div>
              <div className="highlight-copy">Ideal rep targets and preferred training blocks.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ExerciseDetail
