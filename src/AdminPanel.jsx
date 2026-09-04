import { useRef, useState } from 'react'
import './AdminPanel.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const ADMIN_TOKEN_KEY = 'hr-assistant-admin-token'

function AdminPanel({ onNavigate, onLogout }) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [uploadResults, setUploadResults] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [uploadType, setUploadType] = useState('multiple') // 'single', 'multiple', 'zip'
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFiles(files)
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      handleFiles(files)
    }
  }

  const validateFiles = (files) => {
    const errors = []

    files.forEach((file) => {
      if (uploadType === 'zip' && !file.name.toLowerCase().endsWith('.zip')) {
        errors.push(`${file.name} is not a zip file`)
      } else if (uploadType !== 'zip' && !file.name.toLowerCase().endsWith('.pdf')) {
        errors.push(`${file.name} is not a PDF file`)
      }
    })

    return errors
  }

  const handleFiles = async (files) => {
    const validationErrors = validateFiles(files)

    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '))
      return
    }

    setError('')
    setUploadResults([])

    const filesToUpload = uploadType === 'single' ? [files[0]] : files

    await uploadFiles(filesToUpload)
  }

  const uploadFiles = async (files) => {
    const token = window.localStorage.getItem(ADMIN_TOKEN_KEY)
    if (!token) {
      setError('Admin session expired. Please sign in again.')
      setIsUploading(false)
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    const results = []
    const newProgress = {}

    files.forEach((file) => {
      newProgress[file.name] = { status: 'uploading', progress: 0 }
    })
    setUploadProgress(newProgress)

    try {
      if (uploadType === 'single' && files.length > 0) {
        // Single file upload
        const file = files[0]
        const singleFormData = new FormData()
        singleFormData.append('file', file)

        const response = await fetch(`${API_URL}/admin/upload-document`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: singleFormData,
        })

        const data = await response.json()

        if (response.ok) {
          results.push({
            filename: file.name,
            success: true,
            message: data.message,
            chunks_created: data.chunks_created,
          })
          newProgress[file.name] = { status: 'success', progress: 100 }
        } else {
          results.push({
            filename: file.name,
            success: false,
            error: data.detail || 'Upload failed',
          })
          newProgress[file.name] = { status: 'error', progress: 0 }
        }
      } else if (uploadType === 'multiple') {
        // Multiple files upload
        files.forEach((file) => {
          formData.append('files', file)
        })

        const response = await fetch(`${API_URL}/admin/upload-documents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        const data = await response.json()

        if (response.ok) {
          // Process successful uploads
          if (data.uploaded) {
            data.uploaded.forEach((upload) => {
              results.push({
                filename: upload.document_name,
                success: true,
                message: upload.message,
                chunks_created: upload.chunks_created,
              })
              newProgress[upload.document_name] = { status: 'success', progress: 100 }
            })
          }

          // Process failed uploads
          if (data.failed) {
            data.failed.forEach((failed) => {
              results.push({
                filename: failed.filename,
                success: false,
                error: failed.error,
              })
              newProgress[failed.filename] = { status: 'error', progress: 0 }
            })
          }
        } else {
          // All files failed
          files.forEach((file) => {
            results.push({
              filename: file.name,
              success: false,
              error: data.detail || 'Upload failed',
            })
            newProgress[file.name] = { status: 'error', progress: 0 }
          })
        }
      } else if (uploadType === 'zip') {
        // Zip file upload
        const file = files[0]
        const zipFormData = new FormData()
        zipFormData.append('file', file)

        const response = await fetch(`${API_URL}/admin/upload-zip`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: zipFormData,
        })

        const data = await response.json()

        if (response.ok) {
          // Process uploaded files from zip
          if (data.uploaded) {
            data.uploaded.forEach((upload) => {
              results.push({
                filename: upload.document_name,
                success: true,
                message: upload.message,
                chunks_created: upload.chunks_created,
              })
              newProgress[upload.document_name] = { status: 'success', progress: 100 }
            })
          }

          // Process failed files
          if (data.failed) {
            data.failed.forEach((failed) => {
              results.push({
                filename: failed.filename,
                success: false,
                error: failed.error,
              })
              newProgress[failed.filename] = { status: 'error', progress: 0 }
            })
          }
        } else {
          results.push({
            filename: file.name,
            success: false,
            error: data.detail || 'Upload failed',
          })
          newProgress[file.name] = { status: 'error', progress: 0 }
        }
      }

      setUploadResults(results)
      setUploadProgress(newProgress)
    } catch (err) {
      setError(err.message || 'Upload failed')
      files.forEach((file) => {
        newProgress[file.name] = { status: 'error', progress: 0 }
      })
      setUploadProgress(newProgress)
    } finally {
      setIsUploading(false)
      fileInputRef.current.value = ''
    }
  }

  const successCount = uploadResults.filter((r) => r.success).length
  const failureCount = uploadResults.filter((r) => !r.success).length

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-mark" aria-hidden="true">
            ADMIN
          </div>
          <div>
            <p className="admin-eyebrow">Document Management</p>
            <h1>Policy Upload Center</h1>
          </div>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="back-button"
            onClick={() => onNavigate('chat')}
            title="Back to chat"
          >
            ← Back to Chat
          </button>
          <button
            type="button"
            className="logout-button"
            onClick={onLogout}
            title="Log out"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="admin-content">
        <div className="upload-panel">
          <div className="upload-config">
            <h2>Upload Configuration</h2>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="single"
                  checked={uploadType === 'single'}
                  onChange={(e) => setUploadType(e.target.value)}
                  disabled={isUploading}
                />
                <span>Single PDF</span>
                <small>Upload one document at a time</small>
              </label>
              <label>
                <input
                  type="radio"
                  value="multiple"
                  checked={uploadType === 'multiple'}
                  onChange={(e) => setUploadType(e.target.value)}
                  disabled={isUploading}
                />
                <span>Multiple PDFs</span>
                <small>Upload multiple documents at once</small>
              </label>
              <label>
                <input
                  type="radio"
                  value="zip"
                  checked={uploadType === 'zip'}
                  onChange={(e) => setUploadType(e.target.value)}
                  disabled={isUploading}
                />
                <span>Zip Archive</span>
                <small>Upload a zip file containing multiple documents</small>
              </label>
            </div>
          </div>

          <div className="upload-area-wrapper">
            <div
              className={`upload-area ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex="0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current?.click()
                }
              }}
            >
              <div className="upload-icon" aria-hidden="true">
                📁
              </div>
              <div className="upload-text">
                <h3>Drag and drop your files here</h3>
                <p>or</p>
              </div>
              <button
                type="button"
                className="choose-files-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                Choose Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple={uploadType !== 'single'}
                accept={uploadType === 'zip' ? '.zip' : '.pdf'}
                onChange={handleFileSelect}
                disabled={isUploading}
                style={{ display: 'none' }}
              />
              <small className="upload-hint">
                {uploadType === 'zip'
                  ? 'Maximum file size: 500MB. Zip archives only.'
                  : 'Maximum file size: 100MB per document. PDF files only.'}
              </small>
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {uploadResults.length > 0 && (
            <div className="upload-results">
              <div className="results-header">
                <h3>Upload Results</h3>
                <div className="results-summary">
                  <span className="success-count">{successCount} successful</span>
                  {failureCount > 0 && <span className="failure-count">{failureCount} failed</span>}
                </div>
              </div>

              <div className="results-list">
                {uploadResults.map((result, index) => (
                  <div
                    key={`${result.filename}-${index}`}
                    className={`result-item ${result.success ? 'success' : 'failure'}`}
                  >
                    <div className="result-status">
                      <span className="result-icon">{result.success ? '✓' : '✕'}</span>
                    </div>
                    <div className="result-details">
                      <p className="result-filename">{result.filename}</p>
                      {result.success ? (
                        <p className="result-message">
                          {result.message} — {result.chunks_created} chunks created
                        </p>
                      ) : (
                        <p className="result-error">{result.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="clear-results-btn"
                onClick={() => {
                  setUploadResults([])
                  setUploadProgress({})
                }}
              >
                Clear Results
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default AdminPanel
