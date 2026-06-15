export default function LoadingSpinner({ full }) {
  if (full) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Spinner />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner />
    </div>
  )
}

function Spinner() {
  return (
    <div className="w-10 h-10 border-4 border-brand-700 border-t-brand-400 rounded-full animate-spin" />
  )
}
