function Settings() {
  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="page-title">Manage your connection and preferences.</h1>
          <p className="page-subtitle">Credentials stay in your browser storage and can be cleared anytime.</p>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2 className="section-title">Connection</h2>
          <div className="form-grid">
            <label className="form-field">
              <span>Region</span>
              <select defaultValue="global">
                <option value="global">Global</option>
                <option value="eu">Europe</option>
              </select>
            </label>
            <label className="form-field">
              <span>Session token</span>
              <input type="password" placeholder="Paste token" />
            </label>
            <label className="form-field">
              <span>User ID</span>
              <input type="text" placeholder="Optional" />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="button">Save connection</button>
            <button className="btn btn-ghost" type="button">Clear</button>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Preferences</h2>
          <div className="form-grid">
            <label className="form-field">
              <span>Unit system</span>
              <select defaultValue="metric">
                <option value="metric">Metric (kg)</option>
                <option value="imperial">Imperial (lb)</option>
              </select>
            </label>
            <label className="form-field">
              <span>Device profile</span>
              <select defaultValue="standard">
                <option value="standard">Standard</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="form-field">
              <span>Offline cache</span>
              <select defaultValue="smart">
                <option value="smart">Smart cache</option>
                <option value="manual">Manual only</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="button">Save preferences</button>
          </div>
        </div>
      </section>

      <section className="card callout">
        <div>
          <h2 className="section-title">Storage notice</h2>
          <p className="page-subtitle">
            No proprietary data is stored on any server. Clearing your browser storage fully removes cached
            sessions, media, and tokens.
          </p>
        </div>
        <button className="btn btn-outline" type="button">Clear local cache</button>
      </section>
    </div>
  )
}

export default Settings
