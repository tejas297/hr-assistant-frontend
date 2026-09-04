import { useEffect, useState } from 'react'
import './App.css'
import AdminPanel from './AdminPanel'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SESSION_KEY = 'hr-assistant-session-id'
const CURRENT_VIEW_KEY = 'hr-assistant-current-view'
const ADMIN_TOKEN_KEY = 'hr-assistant-admin-token'
const suggestions = [
  'What is asset management?',
  'What is the work from home policy?',
  'How do I apply for leave?',
]

function makeSessionId() {
  return `web-${crypto.randomUUID()}`
}

function App() {
  const [sessionId] = useState(() => {
    const stored = window.localStorage.getItem(SESSION_KEY)
    if (stored) return stored
    const next = makeSessionId()
    window.localStorage.setItem(SESSION_KEY, next)
    return next
  })
  const [currentView, setCurrentView] = useState(() => {
    return window.localStorage.getItem(CURRENT_VIEW_KEY) || 'chat'
  })
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [health, setHealth] = useState('checking')
  const [error, setError] = useState('')
  const [adminForm, setAdminForm] = useState({ username: '', password: '' })
  const [adminError, setAdminError] = useState('')
  const [adminAuthenticated, setAdminAuthenticated] = useState(() => {
    return Boolean(window.localStorage.getItem(ADMIN_TOKEN_KEY))
  })

  const handleViewChange = (view) => {
    setCurrentView(view)
    window.localStorage.setItem(CURRENT_VIEW_KEY, view)
  }

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`)
      if (!response.ok) throw new Error('Health check failed')
      setHealth('online')
    } catch {
      setHealth('offline')
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  const handleAdminLogin = async (event) => {
    event.preventDefault()
    setAdminError('')

    try {
      const response = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminForm.username,
          password: adminForm.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid username or password')
      }

      window.localStorage.setItem(ADMIN_TOKEN_KEY, data.access_token)
      setAdminAuthenticated(true)
      setCurrentView('admin')
      window.localStorage.setItem(CURRENT_VIEW_KEY, 'admin')
    } catch (loginError) {
      setAdminError(loginError.message || 'Login failed')
    }
  }

  const handleAdminLogout = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY)
    setAdminAuthenticated(false)
    setAdminForm({ username: '', password: '' })
    setCurrentView('chat')
    window.localStorage.setItem(CURRENT_VIEW_KEY, 'chat')
  }

  const submitQuestion = async (event) => {
    event?.preventDefault()
    const trimmedQuestion = question.trim()
    console.log('Submitting question:', trimmedQuestion)
    if (!trimmedQuestion || isLoading) return

    setMessages((current) => [...current, { role: 'user', content: trimmedQuestion }])
    setQuestion('')
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question: trimmedQuestion }),
      })
      const data = await response.json()
      console.log('API response status:', response.status)
      console.log('API response data:', data)
      
      if (!response.ok) {
        console.error('API error:', data)
        throw new Error(data.detail?.[0]?.msg || data.detail || 'Unable to get an answer')
      }

      if (!data.answer) {
        console.warn('No answer in response:', data)
        throw new Error('No answer received from server')
      }

      setMessages((current) => [...current, {
        role: 'assistant',
        content: data.answer,
        reasoning: data.reasoning,
        sources: data.sources || [],
      }])
    } catch (requestError) {
      console.error('Request error:', requestError)
      setError(requestError.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {currentView === 'admin' ? (
        adminAuthenticated ? (
          <AdminPanel onNavigate={handleViewChange} onLogout={handleAdminLogout} />
        ) : (
          <main className="auth-shell">
            <div className="auth-card">
              <div className="auth-header">
                <div className="auth-mark">HR</div>
                <div>
                  <p className="auth-eyebrow">Administrative access</p>
                  <h1>Admin login</h1>
                </div>
              </div>

              <form className="auth-form" onSubmit={handleAdminLogin}>
                <label>
                  <span>Username</span>
                  <input
                    type="text"
                    value={adminForm.username}
                    onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                    placeholder="admin"
                  />
                </label>

                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </label>

                {adminError && <p className="auth-error">{adminError}</p>}

                <div className="auth-actions">
                  <button type="button" className="secondary-button" onClick={() => handleViewChange('chat')}>
                    Back to chat
                  </button>
                  <button type="submit" className="primary-button">
                    Sign in
                  </button>
                </div>
              </form>
            </div>
          </main>
        )
      ) : (
        <main className="app-shell">
          <header className="topbar">
            <div className="brand-container">
              <div className="brand-mark" aria-hidden="true">
                HR
              </div>
              <div>
                <p className="eyebrow">People operations</p>
                <h1>Policy companion</h1>
              </div>
            </div>
            <div className="header-controls">
              <button
                className="status"
                type="button"
                onClick={checkHealth}
                title="Check API status"
              >
                <span className={`status-dot ${health}`} />
                {health === 'online'
                  ? 'Online'
                  : health === 'checking'
                    ? 'Checking'
                    : 'Offline'}
              </button>
              <button
                className="nav-button admin-nav"
                type="button"
                onClick={() => handleViewChange('admin')}
                title="Go to admin panel"
              >
                Admin
              </button>
            </div>
          </header>

          <section className="welcome-panel">
            <div>
              <p className="eyebrow">Your HR desk, in plain language</p>
              <h2>What can I help you find?</h2>
              <p className="welcome-copy">
                Ask about company policies and I will look through the approved HR documents for you.
              </p>
            </div>
            <div className="welcome-stamp" aria-hidden="true">
              Ask
              <br />
              away
            </div>
          </section>

          <section className="conversation" aria-live="polite">
            {messages.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">
                  ?
                </span>
                <p>Start with a question below.</p>
                <div className="suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setQuestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="message-label">
                  {message.role === 'user' ? 'You' : 'Policy companion'}
                </div>
                <div className="message-body">{message.content}</div>
                {message.reasoning && (
                  <details className="reasoning">
                    <summary>How this answer was found</summary>
                    <p>{message.reasoning}</p>
                  </details>
                )}
                {message.sources?.length > 0 && (
                  <div className="sources">
                    <span>Sources</span>
                    {message.sources.map((source) => (
                      <small key={`${source.document_name}-${source.page_number}`}>
                        {source.document_name}, page {source.page_number}
                      </small>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {isLoading && (
              <div className="message assistant loading">
                <div className="message-label">Policy companion</div>
                <div className="typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </section>

          <form className="composer" onSubmit={submitQuestion}>
            <label htmlFor="question">Ask about an HR policy</label>
            <div className="composer-row">
              <textarea
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="For example, what is the leave policy?"
                rows="1"
                maxLength="1000"
                disabled={isLoading}
              />
              <button
                className="send-button"
                type="submit"
                disabled={!question.trim() || isLoading}
                aria-label="Send question"
              >
                Send <span aria-hidden="true">-&gt;</span>
              </button>
            </div>
            <div className="composer-footer">
              <span>Answers come from your HR policy library.</span>
              <span>{question.length}/1000</span>
            </div>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </form>
        </main>
      )}
    </>
  )
}

export default App
