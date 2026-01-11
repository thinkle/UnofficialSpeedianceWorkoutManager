import { NavLink } from 'react-router-dom'

function NotFound() {
  return (
    <div className="page center">
      <div className="card not-found">
        <p className="eyebrow">404</p>
        <h1 className="page-title">This page is off-plan.</h1>
        <p className="page-subtitle">Return to the dashboard to keep building.</p>
        <NavLink className="btn btn-primary" to="/">
          Back to dashboard
        </NavLink>
      </div>
    </div>
  )
}

export default NotFound
