'use client'

interface UltraSimpleModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UltraSimpleModal({ isOpen, onClose }: UltraSimpleModalProps) {
  if (!isOpen) {
    console.log('UltraSimpleModal: not open, returning null')
    return null
  }

  console.log('UltraSimpleModal: rendering modal')

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          minWidth: '300px',
          maxWidth: '500px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
          Ultra Simple Modal
        </h2>
        <p style={{ margin: '0 0 16px 0' }}>
          This is the simplest possible modal. If you can see this, the modal system works.
        </p>
        <button
          onClick={onClose}
          style={{
            backgroundColor: '#4F46E5',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
