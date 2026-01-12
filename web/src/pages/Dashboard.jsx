import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCalendarMonth, fetchWorkouts, scheduleWorkout } from '../lib/workouts.js'
import { useAuth } from '../state/AuthContext.jsx'

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getMonthLabel(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

function getMonthString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function isPastDate(dateStr) {
  return dateStr < getTodayString()
}

function normalizeWorkouts(items) {
  if (!Array.isArray(items)) return []
  return items.map((item) => ({
    ...item,
    title: item.name || item.title || 'Workout',
  }))
}

function Dashboard() {
  const { config, isAuthenticated, clearAuth } = useAuth()
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState([])
  const [workoutStatus, setWorkoutStatus] = useState({ type: 'idle', message: '' })
  const [calendarStatus, setCalendarStatus] = useState({ type: 'idle', message: '' })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarData, setCalendarData] = useState([])
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadWorkouts = async () => {
      if (!isAuthenticated) return
      setWorkoutStatus({ type: 'loading', message: 'Loading workouts...' })
      const response = await fetchWorkouts(config)
      if (!isMounted) return

      if (response.unauthorized) {
        clearAuth()
        navigate('/settings', { replace: true })
        return
      }

      if (!response.ok) {
        setWorkoutStatus({ type: 'error', message: response.error || 'Failed to load workouts.' })
        return
      }

      setWorkouts(normalizeWorkouts(response.data))
      setWorkoutStatus({ type: 'success', message: '' })
    }

    loadWorkouts()

    return () => {
      isMounted = false
    }
  }, [config, isAuthenticated, clearAuth, navigate])

  useEffect(() => {
    let isMounted = true

    const loadCalendar = async () => {
      if (!isAuthenticated) return
      setCalendarStatus({ type: 'loading', message: 'Loading calendar...' })
      const response = await fetchCalendarMonth(config, getMonthString(currentDate))
      if (!isMounted) return

      if (response.unauthorized) {
        clearAuth()
        navigate('/settings', { replace: true })
        return
      }

      if (!response.ok) {
        setCalendarStatus({ type: 'error', message: response.error || 'Failed to load calendar.' })
        return
      }

      setCalendarData(Array.isArray(response.data) ? response.data : [])
      setCalendarStatus({ type: 'success', message: '' })
    }

    loadCalendar()

    return () => {
      isMounted = false
    }
  }, [config, isAuthenticated, currentDate, clearAuth, navigate])

  const filteredWorkouts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return workouts
    return workouts.filter((workout) => (workout.title || '').toLowerCase().includes(term))
  }, [workouts, search])

  const calendarGrid = useMemo(() => {
    if (!calendarData.length) return []
    const firstDate = parseLocalDate(calendarData[0].date)
    const startDay = firstDate ? firstDate.getDay() : 0
    const blanks = Array.from({ length: startDay }).map(() => null)
    return [...blanks, ...calendarData]
  }, [calendarData])

  const handleSelectWorkout = (workout) => {
    if (selectedWorkout && selectedWorkout.code === workout.code) {
      setSelectedWorkout(null)
      return
    }
    setSelectedWorkout(workout)
  }

  const updateCalendarDay = (dateStr, updater) => {
    setCalendarData((current) =>
      current.map((day) => {
        if (day.date !== dateStr) return day
        const updated = { ...day }
        updated.trainingPlanList = updater(updated.trainingPlanList || [])
        return updated
      })
    )
  }

  const handleSchedule = async (dateStr, workout) => {
    if (!workout?.code) return
    if (isPastDate(dateStr)) {
      setCalendarStatus({ type: 'error', message: 'Cannot schedule in the past.' })
      return
    }

    const response = await scheduleWorkout(config, dateStr, workout.code, 1)
    if (response.unauthorized) {
      clearAuth()
      navigate('/settings', { replace: true })
      return
    }
    if (!response.ok) {
      setCalendarStatus({ type: 'error', message: response.error || 'Failed to schedule workout.' })
      return
    }

    updateCalendarDay(dateStr, (list) => {
      const exists = list.some((entry) => (entry.code || entry.templateCode) === workout.code)
      if (exists) return list
      return [...list, { title: workout.title, code: workout.code, isReservation: true }]
    })
  }

  const handleRemoveSchedule = async (dateStr, code) => {
    const response = await scheduleWorkout(config, dateStr, code, 0)
    if (response.unauthorized) {
      clearAuth()
      navigate('/settings', { replace: true })
      return
    }
    if (!response.ok) {
      setCalendarStatus({ type: 'error', message: response.error || 'Failed to remove workout.' })
      return
    }

    updateCalendarDay(dateStr, (list) =>
      list.filter((entry) => (entry.code || entry.templateCode) !== code)
    )
  }

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="page-title">My workouts</h1>
          <p className="page-subtitle">Select a workout to schedule it on the calendar.</p>
        </div>
      </section>

      {workoutStatus.type === 'loading' ? (
        <div className="notice notice-loading">{workoutStatus.message}</div>
      ) : null}
      {workoutStatus.type === 'error' ? (
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
            <div className="dashboard-meta">{filteredWorkouts.length} workouts</div>
          </div>

          <div className="workout-grid">
            {filteredWorkouts.map((workout) => (
              <button
                key={workout.code || workout.id}
                type="button"
                className={`workout-card${selectedWorkout?.code === workout.code ? ' workout-card-active' : ''}`}
                onClick={() => handleSelectWorkout(workout)}
              >
                <div className="workout-card-title">{workout.title}</div>
                <div className="workout-card-meta">
                  <span>Volume: {workout.totalCapacity || '--'} {config.unit === 1 ? 'lbs' : 'kg'}</span>
                  <span>Duration: ~{workout.durationMinute || '--'} min</span>
                  <span>Exercises: {workout.actionNum || '--'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-calendar">
          <div className="calendar-header">
            <button type="button" onClick={() => setCurrentDate((prev) => {
              const next = new Date(prev)
              next.setMonth(next.getMonth() - 1)
              return next
            })}>
              Prev
            </button>
            <span>{getMonthLabel(currentDate)}</span>
            <button type="button" onClick={() => setCurrentDate((prev) => {
              const next = new Date(prev)
              next.setMonth(next.getMonth() + 1)
              return next
            })}>
              Next
            </button>
          </div>

          {calendarStatus.type === 'loading' ? (
            <div className="notice notice-loading">{calendarStatus.message}</div>
          ) : null}
          {calendarStatus.type === 'error' ? (
            <div className="notice notice-error">{calendarStatus.message}</div>
          ) : null}

          <div className="calendar-weekdays">
            {weekDays.map((day) => (
              <div key={day} className="calendar-weekday">{day}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarGrid.map((day, index) => {
              if (!day) {
                return <div key={`blank-${index}`} className="calendar-cell calendar-empty" />
              }

              const dateNumber = parseLocalDate(day.date)?.getDate() || ''
              const entries = day.trainingPlanList || []
              return (
                <div
                  key={day.date}
                  className={`calendar-cell${isPastDate(day.date) ? ' calendar-past' : ''}`}
                  onClick={() => selectedWorkout && handleSchedule(day.date, selectedWorkout)}
                >
                  <div className="calendar-date">{dateNumber}</div>
                  <div className="calendar-events">
                    {entries.map((entry, entryIndex) => {
                      const isProgram = entry.isReservation === false
                      const code = entry.code || entry.templateCode
                      return (
                        <div key={`${day.date}-${code || entryIndex}`} className={`calendar-pill${isProgram ? ' calendar-pill-program' : ''}`}>
                          <span>{entry.title || entry.exclusivePlanName || 'Workout'}</span>
                          {!isProgram && code ? (
                            <button type="button" onClick={(event) => {
                              event.stopPropagation()
                              handleRemoveSchedule(day.date, code)
                            }}>
                              x
                            </button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
